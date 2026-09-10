import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { MASTERY_RECALC_QUEUE, MasteryRecalcJobData } from './mastery-recalc.constants';
import { enqueueDeduped, jobKey, topicSetDigest } from '../infrastructure/queue/enqueue';
import { QUEUE_POLICY } from '../infrastructure/queue/queue-policy';
import { ensureDiagnosableMessage } from '../shared/logging/error-message';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(MASTERY_RECALC_QUEUE) private readonly masteryRecalcQueue: Queue<MasteryRecalcJobData>,
  ) {}

  /**
   * Enqueues an async mastery recalculation (D-02) — replaces the previous raw
   * fire-and-forget in-process call, which had no retry/backoff/dead-letter and
   * would silently lose the recalc entirely if it threw. See 08-ERROR-HANDLING.md.
   */
  async enqueueMasteryRecalc(studentProfileId: string, topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) return;
    // The key includes the SORTED topic set, not just the student. Keying on the
    // student alone would silently drop a recalculation for a different topic as
    // a "duplicate" — a change to mastery semantics, not a de-duplication.
    await enqueueDeduped(
      this.masteryRecalcQueue,
      'recalculate',
      { studentProfileId, topicIds },
      jobKey('mastery', studentProfileId, topicSetDigest(topicIds)),
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.masteryRecalc.jobOptions },
      this.logger,
    );
  }

  // ── D-02: Analytics Engine (Mastery Recalculation) ──────────────────────
  //
  // The actual calculation (EMA formula) lives in apps/api-python's
  // src/analytics/mastery_engine.py, matching 02-SYSTEM-ARCHITECTURE.md's
  // component ownership ("Mastery calc... api-python — not NestJS"). This class
  // only owns the durable trigger (queue above) and the internal HTTP call below;
  // it does no analytics math itself.

  /** Called by MasteryRecalcProcessor — the queue's retry/backoff wraps this call. */
  async requestMasteryRecalc(studentProfileId: string, topicIds: string[]): Promise<void> {
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const startedAt = Date.now();

    try {
      await axios.post(
        `${baseUrl}/analytics/recalculate-mastery`,
        { studentProfileId, topicIds },
        {
          headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined,
          timeout: 15_000,
        },
      );
      this.logger.debug(`Mastery recalc for ${studentProfileId} completed in ${Date.now() - startedAt}ms`);
    } catch (err) {
      // Rethrow so the calling BullMQ job is marked failed and retried — logging
      // here is purely for diagnostics (12-LOGGING-MONITORING.md: log every
      // external service call's outcome), not error handling in itself.
      this.logger.warn(`Mastery recalc HTTP call failed for ${studentProfileId} after ${Date.now() - startedAt}ms`, err as Error);
      throw ensureDiagnosableMessage(err);
    }
  }

  // Analytics for the Dashboard
  async getInstituteOverview(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const [totalStudents, totalTeachers, activeExams] = await Promise.all([
      this.prisma.user.count({ where: { instituteId, role: 'STUDENT', status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { instituteId, role: 'TEACHER', status: 'ACTIVE' } }),
      this.prisma.exam.count({ where: { instituteId, status: { in: ['PUBLISHED', 'ONGOING'] } } }),
    ]);

    return { totalStudents, totalTeachers, activeExams };
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }
}
