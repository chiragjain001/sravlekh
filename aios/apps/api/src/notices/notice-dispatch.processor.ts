import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, NoticeChannel } from '@prisma/client';
import { NOTICE_DISPATCH_QUEUE, NoticeDispatchJobData } from './notice-dispatch.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';

/**
 * Picks up a notice's QUEUED EMAIL/SMS/WHATSAPP deliveries. No real
 * email/SMS/WhatsApp provider is configured in this environment (see
 * 17-THIRD-PARTY-INTEGRATIONS.md) — rather than fake a SENT status, this marks
 * them FAILED with an honest reason so nothing downstream mistakes it for a
 * real delivery. IN_APP deliveries never reach this queue — they're marked
 * SENT synchronously in NoticesService since they need no external provider.
 */
@Processor(NOTICE_DISPATCH_QUEUE)
export class NoticeDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NoticeDispatchProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NoticeDispatchJobData>): Promise<void> {
    await this.prisma.noticeDelivery.updateMany({
      where: {
        noticeId: job.data.noticeId,
        status: DeliveryStatus.QUEUED,
        channel: { in: [NoticeChannel.EMAIL, NoticeChannel.SMS, NoticeChannel.WHATSAPP] },
      },
      data: { status: DeliveryStatus.FAILED, failureReason: 'provider_not_configured' },
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NoticeDispatchJobData> | undefined, err: Error) {
    reportDeadLetter('notice-dispatch', job, err, this.logger, { noticeId: job?.data.noticeId });
  }
}
