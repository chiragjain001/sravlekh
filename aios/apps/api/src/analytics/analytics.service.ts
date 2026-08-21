import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MASTERY_RECALC_QUEUE, MasteryRecalcJobData } from './mastery-recalc.processor';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MASTERY_RECALC_QUEUE) private readonly masteryRecalcQueue: Queue<MasteryRecalcJobData>,
  ) {}

  /**
   * Enqueues an async mastery recalculation (D-02) — replaces the previous raw
   * fire-and-forget in-process call, which had no retry/backoff/dead-letter and
   * would silently lose the recalc entirely if it threw. See 08-ERROR-HANDLING.md.
   */
  async enqueueMasteryRecalc(studentProfileId: string, topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) return;
    await this.masteryRecalcQueue.add(
      'recalculate',
      { studentProfileId, topicIds },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }

  // ── D-02: Analytics Engine (Mastery Recalculation) ──────────────────────

  /**
   * Recalculates the MasteryScore for a student on specific topics
   * based on newly graded responses.
   * This uses an Exponential Moving Average (EMA) approach to weight recent performance heavier.
   */
  async recalculateMastery(studentProfileId: string, topicIds: string[]) {
    // Deduplicate topic IDs
    const uniqueTopics = [...new Set(topicIds)];

    for (const topicId of uniqueTopics) {
      try {
        // Fetch all responses for this student and topic, ordered by exam date ascending
        const responses = await this.prisma.response.findMany({
          where: {
            answerSheet: { studentProfileId },
            question: { topicId },
          },
          include: {
            question: { select: { subjectId: true, difficulty: true } },
          },
          orderBy: { createdAt: 'asc' },
        });

        const firstResponse = responses[0];
        if (!firstResponse) continue;

        const subjectId = firstResponse.question.subjectId;
        
        // Calculate new mastery score using EMA (Exponential Moving Average)
        // Alpha = 2 / (N + 1). For a fast-adapting system, let's use a fixed alpha of 0.3
        const ALPHA = 0.3;
        let currentMastery = 0.5; // Initial baseline is 50%
        let previousMastery = 0.5;

        responses.forEach((resp, index) => {
          // Normalize score for this question (0.0 to 1.0)
          const score = resp.marksAvailable > 0 ? (resp.marksAwarded / resp.marksAvailable) : 0;
          
          // Difficulty multiplier (optional, but good for an advanced engine)
          // Hard questions give more mastery, easy questions expect perfection
          let difficultyWeight = 1.0;
          if (resp.question.difficulty === 'HARD') difficultyWeight = 1.2;
          if (resp.question.difficulty === 'EASY') difficultyWeight = 0.8;
          
          const adjustedScore = Math.min(1.0, score * difficultyWeight);

          if (index === 0) {
            currentMastery = adjustedScore; // First attempt sets baseline
          } else {
            previousMastery = currentMastery;
            currentMastery = (adjustedScore * ALPHA) + (currentMastery * (1 - ALPHA));
          }
        });

        const trend = currentMastery - previousMastery;

        // Upsert the MasteryScore record
        await this.prisma.masteryScore.upsert({
          where: {
            studentProfileId_topicId: {
              studentProfileId,
              topicId,
            }
          },
          create: {
            studentProfileId,
            subjectId,
            topicId,
            masteryValue: currentMastery,
            trend,
            sampleCount: responses.length,
          },
          update: {
            masteryValue: currentMastery,
            trend,
            sampleCount: responses.length,
            lastUpdatedAt: new Date(),
          }
        });

      } catch (err) {
        this.logger.error(`Failed to recalculate mastery for student ${studentProfileId}, topic ${topicId}`, err);
      }
    }
  }

  // Analytics for the Dashboard
  async getInstituteOverview(instituteId: string) {
    const [totalStudents, totalTeachers, activeExams] = await Promise.all([
      this.prisma.user.count({ where: { instituteId, role: 'STUDENT', status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { instituteId, role: 'TEACHER', status: 'ACTIVE' } }),
      this.prisma.exam.count({ where: { instituteId, status: { in: ['PUBLISHED', 'ONGOING'] } } }),
    ]);

    return { totalStudents, totalTeachers, activeExams };
  }
}
