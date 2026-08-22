import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 25-EVALUATION-ENGINE.md §5: ScoreRecord is recomputed by summing, across
 * every Response in an Attempt, the marksAwarded of that Response's CURRENT
 * EvaluationVersion (via Evaluation.currentEvaluationVersionId) — falling
 * back to Response.marksAwarded directly for objective evidence (DIGITAL_
 * VALUE/OMR_MARK), which is scored at capture time and never gets an
 * Evaluation row at all. Triggered async on every EvaluationVersion write,
 * same fire-and-forget-via-queue pattern as v1's mastery recalculation.
 */
@Injectable()
export class ScoreAggregationService {
  private readonly logger = new Logger(ScoreAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recalculate(attemptId: string): Promise<void> {
    const responses = await this.prisma.response.findMany({
      where: { attemptId },
      include: { question: { select: { marks: true } }, evaluation: { include: { currentVersion: true } } },
    });

    let obtainedMarks = 0;
    let totalMarks = 0;
    for (const response of responses) {
      totalMarks += response.question.marks;
      obtainedMarks += response.evaluation?.currentVersion?.marksAwarded ?? response.marksAwarded;
    }
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      this.logger.warn(`Score aggregation skipped — attempt ${attemptId} no longer exists`);
      return;
    }

    await this.prisma.scoreRecord.upsert({
      where: { attemptId },
      create: {
        attemptId,
        studentProfileId: attempt.studentProfileId,
        totalMarks,
        obtainedMarks,
        percentage,
      },
      update: { totalMarks, obtainedMarks, percentage },
    });
  }
}
