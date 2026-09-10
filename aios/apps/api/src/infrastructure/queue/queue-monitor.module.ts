import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueMonitorService } from './queue-monitor.service';
import { RUN_WORKERS } from './queue-policy';
import { AI_EVALUATION_QUEUE } from '../../ai-evaluation/ai-evaluation.constants';
import { OCR_QUEUE } from '../../ocr/ocr.constants';
import { SCORE_AGGREGATION_QUEUE } from '../../evaluations/score-aggregation.constants';
import { MASTERY_RECALC_QUEUE } from '../../analytics/mastery-recalc.constants';
import { NOTICE_DISPATCH_QUEUE } from '../../notices/notice-dispatch.constants';
import { REPORT_GENERATION_QUEUE } from '../../reports/report-generation.constants';

/**
 * Depth monitoring for all six queues.
 *
 * Each registerQueue here reuses the named queue its owning module already
 * registered — same Redis connection, same jobs, only a second injectable
 * handle. Identical to the pattern FounderModule uses for
 * GET /founder/health/queues.
 *
 * PROVIDED ONLY WHERE WORKERS RUN. Sampling from every API replica would
 * multiply one real backlog into N identical alerts, which is precisely how a
 * useful alert becomes one people mute. RUN_WORKERS is the existing flag that
 * distinguishes a job-consuming process from a request-serving one, so the
 * monitor follows the workers rather than introducing a second, separate switch
 * that could disagree with it.
 *
 * With the default single-process deployment (RUN_WORKERS unset), monitoring is
 * on. With a dedicated worker (RUN_WORKERS=false on the API), it runs only
 * there — exactly once.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: AI_EVALUATION_QUEUE },
      { name: OCR_QUEUE },
      { name: SCORE_AGGREGATION_QUEUE },
      { name: MASTERY_RECALC_QUEUE },
      { name: NOTICE_DISPATCH_QUEUE },
      { name: REPORT_GENERATION_QUEUE },
    ),
  ],
  providers: RUN_WORKERS ? [QueueMonitorService] : [],
})
export class QueueMonitorModule {}
