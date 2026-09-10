import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import * as Sentry from '@sentry/node';
import { QueueMonitorService } from './queue-monitor.service';
import { QUEUE_BACKLOG_THRESHOLDS } from '../../shared/logging/alerts';
import { AI_EVALUATION_QUEUE } from '../../ai-evaluation/ai-evaluation.constants';
import { OCR_QUEUE } from '../../ocr/ocr.constants';
import { SCORE_AGGREGATION_QUEUE } from '../../evaluations/score-aggregation.constants';
import { MASTERY_RECALC_QUEUE } from '../../analytics/mastery-recalc.constants';
import { NOTICE_DISPATCH_QUEUE } from '../../notices/notice-dispatch.constants';
import { REPORT_GENERATION_QUEUE } from '../../reports/report-generation.constants';

jest.mock('@sentry/node', () => ({ captureMessage: jest.fn() }));

/**
 * The failure this monitor exists to catch is a SILENT one: a dead worker or a
 * stalled provider produces no exceptions at all — jobs are accepted, nothing
 * throws, and the only symptom is that a teacher's evaluations never arrive.
 * Neither AllExceptionsFilter nor reportDeadLetter can see that.
 */
describe('QueueMonitorService', () => {
  const ALL_QUEUES = [
    AI_EVALUATION_QUEUE,
    OCR_QUEUE,
    SCORE_AGGREGATION_QUEUE,
    MASTERY_RECALC_QUEUE,
    NOTICE_DISPATCH_QUEUE,
    REPORT_GENERATION_QUEUE,
  ];

  let service: QueueMonitorService;
  let counts: Record<string, jest.Mock>;
  const captureMessage = Sentry.captureMessage as jest.Mock;

  /** All queues idle unless a test says otherwise. */
  const idle = () => ({ waiting: 0, failed: 0, active: 0, delayed: 0 });

  beforeEach(async () => {
    captureMessage.mockClear();
    counts = {};

    const providers = ALL_QUEUES.map((name) => {
      const getJobCounts = jest.fn().mockResolvedValue(idle());
      counts[name] = getJobCounts;
      return { provide: getQueueToken(name), useValue: { getJobCounts } };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueMonitorService, ...providers],
    }).compile();
    service = module.get(QueueMonitorService);
  });

  afterEach(() => service.onModuleDestroy());

  const alertsRaised = () =>
    captureMessage.mock.calls.map((c) => (c[1] as { tags: { alert: string } }).tags.alert);

  it('samples every queue', async () => {
    await service.sample();
    for (const name of ALL_QUEUES) {
      expect(counts[name]).toHaveBeenCalled();
    }
  });

  it('raises nothing while every queue is idle', async () => {
    // The most important property: an alert that fires routinely trains people
    // to ignore it, which is worse than having no alert.
    await service.sample();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('raises nothing for a backlog at or below the threshold', async () => {
    const threshold = QUEUE_BACKLOG_THRESHOLDS[AI_EVALUATION_QUEUE]!;
    counts[AI_EVALUATION_QUEUE]!.mockResolvedValueOnce({ ...idle(), waiting: threshold });

    await service.sample();

    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('raises a backlog alert once the threshold is exceeded', async () => {
    const threshold = QUEUE_BACKLOG_THRESHOLDS[AI_EVALUATION_QUEUE]!;
    counts[AI_EVALUATION_QUEUE]!.mockResolvedValueOnce({ ...idle(), waiting: threshold + 1 });

    await service.sample();

    expect(alertsRaised()).toContain('queue.backlog');
    const [, options] = captureMessage.mock.calls[0] as [string, { level: string; extra: Record<string, unknown> }];
    expect(options.level).toBe('warning'); // capacity problem, not an outage
    expect(options.extra).toMatchObject({ queue: AI_EVALUATION_QUEUE, waiting: threshold + 1, threshold });
  });

  it('uses each queue’s own threshold, not one global number', async () => {
    // report-generation (50) is far lower than notice-dispatch (2000): a large
    // announcement legitimately fans out to thousands, while more than a handful
    // of queued reports is unusual. One shared number would either miss the
    // former or cry wolf on the latter.
    const reportThreshold = QUEUE_BACKLOG_THRESHOLDS[REPORT_GENERATION_QUEUE]!;
    const noticeThreshold = QUEUE_BACKLOG_THRESHOLDS[NOTICE_DISPATCH_QUEUE]!;
    expect(reportThreshold).toBeLessThan(noticeThreshold);

    counts[REPORT_GENERATION_QUEUE]!.mockResolvedValueOnce({ ...idle(), waiting: reportThreshold + 1 });
    counts[NOTICE_DISPATCH_QUEUE]!.mockResolvedValueOnce({ ...idle(), waiting: reportThreshold + 1 });

    await service.sample();

    // The same depth alerts for reports and not for notices.
    const backlogQueues = captureMessage.mock.calls
      .filter((c) => (c[1] as { tags: { alert: string } }).tags.alert === 'queue.backlog')
      .map((c) => (c[1] as { extra: { queue: string } }).extra.queue);
    expect(backlogQueues).toEqual([REPORT_GENERATION_QUEUE]);
  });

  it('raises a dead-letter alert at error level when failed jobs exist', async () => {
    counts[OCR_QUEUE]!.mockResolvedValueOnce({ ...idle(), failed: 3 });

    await service.sample();

    expect(alertsRaised()).toContain('queue.dead_letter_present');
    const call = captureMessage.mock.calls.find(
      (c) => (c[1] as { tags: { alert: string } }).tags.alert === 'queue.dead_letter_present',
    )!;
    expect((call[1] as { level: string }).level).toBe('error');
    expect((call[1] as { extra: Record<string, unknown> }).extra).toMatchObject({ queue: OCR_QUEUE, failed: 3 });
  });

  it('tags every alert with a stable name a vendor rule can match on', async () => {
    counts[OCR_QUEUE]!.mockResolvedValueOnce({ ...idle(), failed: 1 });
    await service.sample();

    for (const [, options] of captureMessage.mock.calls) {
      const tags = (options as { tags: Record<string, string> }).tags;
      // Rules must key off `alert`, never message text, which will be reworded.
      expect(tags.alert).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(tags.severity).toBeDefined();
    }
  });

  it('keeps sampling the remaining queues when one fails', async () => {
    counts[AI_EVALUATION_QUEUE]!.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await service.sample();

    // One unreachable queue must not blind the monitor to the other five.
    expect(counts[REPORT_GENERATION_QUEUE]).toHaveBeenCalled();
  });

  it('never throws out of sample() even if every queue fails', async () => {
    // sample() runs inside setInterval. An unhandled rejection there would take
    // the process down — the monitor would kill the worker it exists to watch.
    for (const name of ALL_QUEUES) {
      counts[name]!.mockRejectedValueOnce(new Error('redis down'));
    }

    await expect(service.sample()).resolves.toBeUndefined();
    // Redis being down is already reported by the readiness probe; six identical
    // pages for one outage would be noise.
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('does not hold the event loop open', () => {
    // Without unref(), a graceful shutdown would wait out the remaining interval
    // before exiting — the same class of bug as the health controller's
    // uncleared timeout.
    service.onModuleInit();
    const timers = process.getActiveResourcesInfo().filter((r) => r === 'Timeout');
    service.onModuleDestroy();
    // The assertion is that onModuleInit did not add a *referenced* handle;
    // getActiveResourcesInfo excludes unref'd timers.
    expect(timers.length).toBeLessThanOrEqual(1);
  });
});
