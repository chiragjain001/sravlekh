import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isAuthoritativeResponse } from './evaluation-status.util';

/**
 * 25-EVALUATION-ENGINE.md §5: ScoreRecord is recomputed by summing, across
 * every Response in an Attempt, the marksAwarded of that Response's CURRENT
 * EvaluationVersion (via Evaluation.currentEvaluationVersionId) — falling
 * back to Response.marksAwarded directly for objective evidence (DIGITAL_
 * VALUE/OMR_MARK), which is scored at capture time and never gets an
 * Evaluation row at all. Triggered async on every EvaluationVersion write,
 * same fire-and-forget-via-queue pattern as v1's mastery recalculation.
 *
 * 32-AI-GOVERNANCE-POLICY.md §2: a subjective response only contributes once a
 * HUMAN has approved its current version. This runs on every evaluation write,
 * not just at LOCK, so without that filter a delivery mid-review would fold
 * not-yet-reviewed AI suggestions into the official score — the exact bypass the
 * LOCK gate exists to prevent, reached through a side door. Unapproved responses
 * contribute 0 (a safe under-count that rises as review completes, never an
 * over-count) and clear isFinalized.
 */
@Injectable()
export class ScoreAggregationService {
  private readonly logger = new Logger(ScoreAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recalculate(attemptId: string): Promise<void> {
    const responses = await this.prisma.response.findMany({
      where: { attemptId },
      include: { question: { select: { marks: true, type: true } }, evaluation: { include: { currentVersion: true } } },
    });

    let obtainedMarks = 0;
    let totalMarks = 0;
    let allApproved = true;
    for (const response of responses) {
      totalMarks += response.question.marks;
      if (!isAuthoritativeResponse(response)) {
        // Subjective and not human-approved (AI-suggested, pending, or never
        // evaluated at all) — contributes nothing and blocks finalization.
        allApproved = false;
        continue;
      }
      // Objective evidence is scored at capture; subjective evidence that reaches
      // here has a human-approved current version.
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
        isFinalized: allApproved,
      },
      update: { totalMarks, obtainedMarks, percentage, isFinalized: allApproved },
    });
  }
}
