import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
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
import { getTeacherBatchIds } from '../shared/teacher-scope';

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

  /**
   * Aggregates mistake tags (CONCEPT_ERROR, CALCULATION_ERROR, CARELESS, etc.)
   * per topic across all students in a batch, giving teachers immediate visibility
   * into systematic learning gaps.
   */
  async getBatchMistakeSummary(instituteId: string, batchId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, instituteId: true, name: true },
    });
    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found');
    }

    if (actor.role === UserRole.TEACHER) {
      const teacherBatches = await getTeacherBatchIds(this.prisma, actor);
      if (teacherBatches && !teacherBatches.includes(batchId)) {
        throw new ForbiddenException('You do not have access to this batch');
      }
    }

    // WHY THIS CHANGED (C-1 fix): the previous implementation loaded ALL response
    // rows for the batch into Node.js memory using findMany, then aggregated in JS.
    // 200 students × 50 questions = 10,000 rows with nested joins pulled into Node
    // RAM before any counting could happen. Under load this caused OOM pressure and
    // held database connections for the full duration of that hydration.
    //
    // The aggregation is entirely within PostgreSQL now: one round-trip returns only
    // (topicId, topicName, tag, count) tuples — O(topics × tags) rows, not O(responses).
    // JSONB unnest with GROUP BY is natively fast and uses the GIN index on mistakeTags
    // when it exists. The 2000-row LIMIT is a safety bound: a sane batch never has
    // more than a few hundred topic-tag combinations, and an adversarial or broken
    // dataset cannot OOM the Node process.
    type RawRow = {
      topicId: string;
      topicName: string | null;
      tag: string;
      cnt: bigint | number;
      marksLost?: bigint | number;
    };

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      WITH batch_responses AS (
        SELECT
          r.id,
          r."marksAwarded" AS r_awarded,
          r."marksAvailable" AS r_available,
          r."mistakeTags" AS r_tags,
          r."attemptId" AS r_attempt_id,
          q."topicId" AS topic_id,
          t."name" AS topic_name,
          ev."marksAwarded" AS ev_awarded,
          ev."mistakeTagType"::text AS ev_tag
        FROM responses r
        JOIN questions q ON q.id = r."questionId"
        LEFT JOIN topics t ON t.id = q."topicId"
        LEFT JOIN evaluations e ON e."responseId" = r.id
        LEFT JOIN evaluation_versions ev ON ev.id = e."currentEvaluationVersionId"
        WHERE
          (
            r."answerSheetId" IN (
              SELECT ash.id FROM answer_sheets ash
              JOIN student_profiles sp ON sp.id = ash."studentProfileId"
              WHERE sp."batchId" = ${batchId}
            )
            OR r."attemptId" IN (
              SELECT att.id FROM attempts att
              WHERE att."studentProfileId" IN (
                SELECT sp2.id FROM student_profiles sp2 WHERE sp2."batchId" = ${batchId}
              )
            )
          )
          AND (
            -- v1 response: human teacher graded in place
            (r."attemptId" IS NULL)
            -- v2 response: only count if approved by human teacher/reviewer, or objective scored at capture
            OR (r."attemptId" IS NOT NULL AND (ev.id IS NOT NULL AND ev.source IN ('TEACHER', 'REVIEWER') OR e.id IS NULL))
          )
      ),
      tagged_items AS (
        -- Unnest v1 mistakeTags array
        SELECT
          br.topic_id AS "topicId",
          br.topic_name AS "topicName",
          tag.value::text AS tag,
          GREATEST(0, br.r_available - br.r_awarded) AS marks_lost
        FROM batch_responses br
        CROSS JOIN LATERAL unnest(br.r_tags) AS tag(value)
        WHERE cardinality(br.r_tags) > 0

        UNION ALL

        -- v2 evaluation version mistakeTagType
        SELECT
          br.topic_id AS "topicId",
          br.topic_name AS "topicName",
          br.ev_tag AS tag,
          GREATEST(0, br.r_available - COALESCE(br.ev_awarded, br.r_awarded)) AS marks_lost
        FROM batch_responses br
        WHERE br.ev_tag IS NOT NULL

        UNION ALL

        -- Untagged answers where marks were lost (neither v1 tags nor v2 tag present)
        SELECT
          br.topic_id AS "topicId",
          br.topic_name AS "topicName",
          'UNTAGGED' AS tag,
          GREATEST(0, br.r_available - COALESCE(br.ev_awarded, br.r_awarded)) AS marks_lost
        FROM batch_responses br
        WHERE
          (cardinality(br.r_tags) = 0 OR br.r_tags IS NULL)
          AND br.ev_tag IS NULL
          AND COALESCE(br.ev_awarded, br.r_awarded) < br.r_available
      )
      SELECT
        "topicId",
        "topicName",
        tag,
        COUNT(*)::bigint AS cnt,
        ROUND(SUM(marks_lost)::numeric, 2) AS "marksLost"
      FROM tagged_items
      GROUP BY "topicId", "topicName", tag
      ORDER BY COUNT(*) DESC
      LIMIT 2000
    `;

    // Reconstruct the response shape from pre-aggregated DB rows.
    const overallTags: Record<string, number> = {};
    const topicMap = new Map<string, { topicId: string; topicName: string; totalMistakes: number; totalMarksLost?: number; byTag: Record<string, number> }>();
    let totalMistakes = 0;
    let totalMarksLost: number | undefined = undefined;

    for (const row of rows) {
      const count = Number(row.cnt); // bigint → number
      const topicId = row.topicId;
      const topicName = row.topicName ?? 'General';

      overallTags[row.tag] = (overallTags[row.tag] ?? 0) + count;
      totalMistakes += count;

      if (!topicMap.has(topicId)) {
        topicMap.set(topicId, { topicId, topicName, totalMistakes: 0, byTag: {} });
      }
      const topicEntry = topicMap.get(topicId)!;
      topicEntry.totalMistakes += count;
      topicEntry.byTag[row.tag] = (topicEntry.byTag[row.tag] ?? 0) + count;

      if (row.marksLost !== undefined && row.marksLost !== null) {
        const lost = Number(row.marksLost);
        topicEntry.totalMarksLost = (topicEntry.totalMarksLost ?? 0) + lost;
        totalMarksLost = (totalMarksLost ?? 0) + lost;
      }
    }

    const byTopic = Array.from(topicMap.values()).sort((a, b) => b.totalMistakes - a.totalMistakes);

    const result: any = {
      batchId: batch.id,
      batchName: batch.name,
      totalMistakes,
      byTag: overallTags,
      byTopic,
    };
    if (totalMarksLost !== undefined) {
      result.totalMarksLost = Math.round(totalMarksLost * 100) / 100;
    }
    return result;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }
}
