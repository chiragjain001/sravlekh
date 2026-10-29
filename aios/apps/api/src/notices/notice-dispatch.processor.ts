import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTICE_DISPATCH_QUEUE, NoticeDispatchJobData } from './notice-dispatch.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';
import { NoticeDispatchService } from './notice-dispatch.service';

/**
 * Background consumer for the NOTICE_DISPATCH_QUEUE.
 *
 * Dispatches queued EMAIL, SMS, and WHATSAPP notice deliveries using official
 * provider adapters (SendGrid, Meta WhatsApp Cloud API, and DLT SMS Gateway).
 *
 * If credentials are not configured in the active environment, deliveries are
 * marked FAILED with `failureReason: 'provider_not_configured'` honestly without
 * pretending deliveries succeeded or blocking other working channels.
 */
@Processor(NOTICE_DISPATCH_QUEUE, workerOptions(QUEUE_POLICY.noticeDispatch))
export class NoticeDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NoticeDispatchProcessor.name);

  constructor(private readonly dispatchService: NoticeDispatchService) {
    super();
  }

  async process(job: Job<NoticeDispatchJobData>): Promise<void> {
    const noticeId = job.data.noticeId;
    this.logger.log(`Processing notice dispatch for noticeId: ${noticeId}`);
    await this.dispatchService.dispatchNotice(noticeId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NoticeDispatchJobData> | undefined, err: Error) {
    reportDeadLetter('notice-dispatch', job, err, this.logger, { noticeId: job?.data.noticeId });
  }
}
