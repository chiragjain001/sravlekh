import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  alertQueueBacklog,
  alertDeadLetterPresent,
  QUEUE_BACKLOG_THRESHOLDS,
} from '../../shared/logging/alerts';
import { AI_EVALUATION_QUEUE } from '../../ai-evaluation/ai-evaluation.constants';
import { OCR_QUEUE } from '../../ocr/ocr.constants';
import { SCORE_AGGREGATION_QUEUE } from '../../evaluations/score-aggregation.constants';
import { MASTERY_RECALC_QUEUE } from '../../analytics/mastery-recalc.constants';
import { NOTICE_DISPATCH_QUEUE } from '../../notices/notice-dispatch.constants';
import { REPORT_GENERATION_QUEUE } from '../../reports/report-generation.constants';

/**
 * Periodically samples queue depth and raises an alert when work is piling up.
 *
 * THE GAP THIS FILLS: dead-lettered jobs already reach Sentry
 * (reportDeadLetter), and thrown exceptions reach it through
 * AllExceptionsFilter. Neither notices a queue that is simply GROWING. A worker
 * that has died, or a provider that has slowed to a crawl, produces no errors at
 * all — jobs are accepted, nothing fails, and the only symptom is that a
 * teacher's evaluations never arrive. That failure is silent for exactly as long
 * as nobody happens to look at the Founder console.
 *
 * DELIBERATELY SAMPLED, NOT EVENT-DRIVEN. BullMQ can emit per-job events, but
 * alerting on those would fire thousands of times during a normal exam-week
 * burst. What matters is the standing depth a minute later, which is a sample.
 *
 * RUNS ONLY IN THE WORKER PROCESS by default. Every API replica running this
 * would multiply identical alerts by the replica count — the classic way a
 * useful alert becomes noise people mute.
 */
@Injectable()
export class QueueMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMonitorService.name);
  private timer: NodeJS.Timeout | undefined;

  /**
   * 60s. Fast enough that a stalled queue is noticed within a minute, slow
   * enough that the sampling itself is negligible: one `getJobCounts` per queue
   * per minute, six queues.
   */
  private readonly intervalMs = Number(process.env['QUEUE_MONITOR_INTERVAL_MS'] ?? 60_000);

  private readonly queues: { name: string; queue: Queue }[];

  constructor(
    @InjectQueue(AI_EVALUATION_QUEUE) aiEvaluation: Queue,
    @InjectQueue(OCR_QUEUE) ocr: Queue,
    @InjectQueue(SCORE_AGGREGATION_QUEUE) scoreAggregation: Queue,
    @InjectQueue(MASTERY_RECALC_QUEUE) masteryRecalc: Queue,
    @InjectQueue(NOTICE_DISPATCH_QUEUE) noticeDispatch: Queue,
    @InjectQueue(REPORT_GENERATION_QUEUE) reportGeneration: Queue,
  ) {
    this.queues = [
      { name: AI_EVALUATION_QUEUE, queue: aiEvaluation },
      { name: OCR_QUEUE, queue: ocr },
      { name: SCORE_AGGREGATION_QUEUE, queue: scoreAggregation },
      { name: MASTERY_RECALC_QUEUE, queue: masteryRecalc },
      { name: NOTICE_DISPATCH_QUEUE, queue: noticeDispatch },
      { name: REPORT_GENERATION_QUEUE, queue: reportGeneration },
    ];
  }

  onModuleInit(): void {
    if (this.intervalMs <= 0) {
      this.logger.log('Queue monitoring disabled (QUEUE_MONITOR_INTERVAL_MS <= 0).');
      return;
    }
    // unref() so this timer never keeps the process alive on its own. Without it,
    // a graceful shutdown would wait out the remaining interval before exiting —
    // the same class of bug as the health controller's uncleared timeout.
    this.timer = setInterval(() => void this.sample(), this.intervalMs);
    this.timer.unref();
    this.logger.log(`Queue monitoring every ${this.intervalMs}ms across ${this.queues.length} queues.`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * One sampling pass. Public so it can be invoked directly by a test or a
   * one-shot diagnostic without waiting for the timer.
   */
  async sample(): Promise<void> {
    for (const { name, queue } of this.queues) {
      try {
        const counts = await queue.getJobCounts('waiting', 'failed', 'active', 'delayed');
        const waiting = counts['waiting'] ?? 0;
        const failed = counts['failed'] ?? 0;

        const threshold = QUEUE_BACKLOG_THRESHOLDS[name];
        if (threshold !== undefined && waiting > threshold) {
          alertQueueBacklog(name, waiting, threshold, this.logger);
        }

        if (failed > 0) {
          alertDeadLetterPresent(name, failed, this.logger);
        }

        this.logger.debug(
          `queue=${name} waiting=${waiting} active=${counts['active'] ?? 0} delayed=${counts['delayed'] ?? 0} failed=${failed}`,
        );
      } catch (err) {
        // Redis being unreachable is already surfaced by the readiness probe.
        // Re-alerting per queue would produce six identical pages for one
        // outage, so this is logged and left alone. Crucially it does not throw:
        // an unhandled rejection inside a setInterval callback would take the
        // whole process down, meaning the monitor could kill the worker it exists
        // to watch.
        this.logger.warn(`Could not sample queue "${name}": ${(err as Error).message}`);
      }
    }
  }
}
