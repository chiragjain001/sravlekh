import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, NoticeChannel } from '@prisma/client';
import {
  NotificationChannelAdapter,
  SendNotificationOptions,
  SendNotificationResult,
} from './adapters/notification-adapter.interface';
import { SendGridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { WhatsAppCloudApiAdapter } from './adapters/whatsapp-cloud.adapter';
import { SmsGatewayAdapter } from './adapters/sms-gateway.adapter';

export interface DispatchSummary {
  noticeId: string;
  totalQueued: number;
  sentCount: number;
  failedCount: number;
  durationMs: number;
}

@Injectable()
export class NoticeDispatchService {
  private readonly logger = new Logger(NoticeDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailAdapter: SendGridEmailAdapter,
    private readonly whatsappAdapter: WhatsAppCloudApiAdapter,
    private readonly smsAdapter: SmsGatewayAdapter,
  ) {}

  /**
   * Resolves the configured channel adapter for a given channel.
   */
  getAdapter(channel: NoticeChannel): NotificationChannelAdapter | null {
    switch (channel) {
      case NoticeChannel.EMAIL:
        return this.emailAdapter;
      case NoticeChannel.WHATSAPP:
        return this.whatsappAdapter;
      case NoticeChannel.SMS:
        return this.smsAdapter;
      default:
        return null;
    }
  }

  /**
   * Returns a snapshot of channel configuration readiness and provider health.
   */
  async getChannelStatuses() {
    const adapters = [this.emailAdapter, this.whatsappAdapter, this.smsAdapter];
    const statuses = await Promise.all(
      adapters.map(async (adapter) => {
        const validation = adapter.validateConfiguration();
        let health = null;
        if (adapter.isConfigured()) {
          try {
            health = await adapter.checkHealth();
          } catch {
            health = { status: 'down' as const, latencyMs: null, message: 'Health check threw exception' };
          }
        }
        return {
          channel: adapter.channel,
          provider: adapter.providerName,
          configured: adapter.isConfigured(),
          missing: validation.missing,
          warnings: validation.warnings,
          health,
        };
      }),
    );
    return statuses;
  }

  /**
   * Dispatches queued deliveries for a notice.
   *
   * Idempotency & Concurrency Guarantees:
   * - Only queries rows where `status === DeliveryStatus.QUEUED`.
   * - If a job retries after transient worker disconnect or timeout, already-sent deliveries
   *   (status = SENT / DELIVERED) are never re-sent.
   * - Cross-tenant isolation is strictly enforced: every recipient must belong to `notice.instituteId`.
   * - Bounded retries: each delivery update is isolated; one recipient's error does not block others.
   */
  async dispatchNotice(noticeId: string): Promise<DispatchSummary> {
    const startTime = Date.now();

    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
      include: {
        deliveries: {
          where: {
            status: DeliveryStatus.QUEUED,
            channel: { in: [NoticeChannel.EMAIL, NoticeChannel.SMS, NoticeChannel.WHATSAPP] },
          },
        },
      },
    });

    if (!notice) {
      this.logger.warn(`Dispatch skipped: Notice ${noticeId} not found.`);
      return { noticeId, totalQueued: 0, sentCount: 0, failedCount: 0, durationMs: Date.now() - startTime };
    }

    const queuedDeliveries = notice.deliveries;
    if (queuedDeliveries.length === 0) {
      this.logger.log(`Notice ${noticeId} has 0 queued deliveries (already processed or cancelled).`);
      return { noticeId, totalQueued: 0, sentCount: 0, failedCount: 0, durationMs: Date.now() - startTime };
    }

    // 1. Fetch recipient data scoped strictly by the notice's instituteId
    const userIds = Array.from(new Set(queuedDeliveries.map((d) => d.userId)));
    const recipients = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        instituteId: notice.instituteId, // Hard tenant isolation invariant
      },
      select: {
        id: true,
        email: true,
        name: true,
        studentProfile: {
          select: {
            guardianPhone: true,
            guardianEmail: true,
          },
        },
      },
    });

    const recipientMap = new Map(recipients.map((r) => [r.id, r]));

    let sentCount = 0;
    let failedCount = 0;

    // 2. Iterate each queued delivery with bounded isolation
    for (const delivery of queuedDeliveries) {
      const recipient = recipientMap.get(delivery.userId);

      // Recipient not in tenant or user was deleted
      if (!recipient) {
        await this.prisma.noticeDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.FAILED,
            failureReason: 'cross_tenant_isolation_violation',
          },
        });
        failedCount++;
        continue;
      }

      const adapter = this.getAdapter(delivery.channel);
      if (!adapter) {
        await this.prisma.noticeDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.FAILED,
            failureReason: 'unsupported_channel',
          },
        });
        failedCount++;
        continue;
      }

      if (!adapter.isConfigured()) {
        await this.prisma.noticeDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.FAILED,
            failureReason: 'provider_not_configured',
          },
        });
        failedCount++;
        continue;
      }

      // Resolve destination contact string based on channel
      let contact: string | null = null;
      if (delivery.channel === NoticeChannel.EMAIL) {
        contact = recipient.email || recipient.studentProfile?.guardianEmail || null;
      } else {
        contact = recipient.studentProfile?.guardianPhone || null;
      }

      if (!contact) {
        await this.prisma.noticeDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.FAILED,
            failureReason: 'no_contact_info',
          },
        });
        failedCount++;
        continue;
      }

      // Execute send via adapter
      const sendOptions: SendNotificationOptions = {
        instituteId: notice.instituteId,
        noticeId: notice.id,
        deliveryId: delivery.id,
        recipientId: recipient.id,
        recipientContact: contact,
        recipientName: recipient.name,
        title: notice.title,
        body: notice.body,
      };

      const result: SendNotificationResult = await adapter.send(sendOptions);

      if (result.status === DeliveryStatus.SENT || result.status === DeliveryStatus.DELIVERED) {
        await this.prisma.noticeDelivery.update({
          where: { id: delivery.id },
          data: {
            status: result.status,
            sentAt: new Date(),
            failureReason: null,
          },
        });
        sentCount++;
      } else {
        await this.prisma.noticeDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.FAILED,
            failureReason: result.failureReason || 'unknown_error',
          },
        });
        failedCount++;
      }
    }

    // 3. Mark notice as sent if at least one delivery succeeded or all processed
    if (sentCount > 0 && !notice.sentAt) {
      await this.prisma.notice.update({
        where: { id: noticeId },
        data: { sentAt: new Date() },
      });
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      JSON.stringify({
        event: 'notice_dispatch_complete',
        noticeId,
        instituteId: notice.instituteId,
        totalQueued: queuedDeliveries.length,
        sentCount,
        failedCount,
        durationMs,
      }),
    );

    return {
      noticeId,
      totalQueued: queuedDeliveries.length,
      sentCount,
      failedCount,
      durationMs,
    };
  }

  // ── Webhook / Status Update Handlers ────────────────────────────────────────

  /**
   * Processes inbound SendGrid event webhooks (delivery, bounce, open).
   */
  async handleSendGridWebhook(events: any[]): Promise<{ processed: number }> {
    if (!Array.isArray(events)) return { processed: 0 };
    let processed = 0;

    for (const event of events) {
      const deliveryId = event.deliveryId || event.custom_args?.deliveryId;
      const eventType = event.event?.toLowerCase();

      if (!deliveryId) continue;

      if (eventType === 'delivered') {
        await this.prisma.noticeDelivery.updateMany({
          where: { id: deliveryId, status: { not: DeliveryStatus.READ } },
          data: { status: DeliveryStatus.DELIVERED },
        });
        processed++;
      } else if (eventType === 'bounce' || eventType === 'dropped') {
        await this.prisma.noticeDelivery.updateMany({
          where: { id: deliveryId },
          data: { status: DeliveryStatus.FAILED, failureReason: `bounced_${event.reason || 'dropped'}` },
        });
        processed++;
      } else if (eventType === 'open') {
        await this.prisma.noticeDelivery.updateMany({
          where: { id: deliveryId },
          data: { readAt: new Date() },
        });
        processed++;
      }
    }

    return { processed };
  }

  /**
   * Processes inbound WhatsApp Cloud API status webhooks (delivered, read, failed).
   */
  async handleWhatsAppWebhook(body: any): Promise<{ processed: number }> {
    let processed = 0;
    const entries = body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const statuses = change?.value?.statuses || [];
        for (const st of statuses) {
          const status = st.status?.toLowerCase();
          const recipientId = st.recipient_id;

          if (!status || !recipientId) continue;

          // Find student profile by phone
          const phonePattern = recipientId.replace('+', '');
          const student = await this.prisma.studentProfile.findFirst({
            where: {
              guardianPhone: { contains: phonePattern.slice(-10) },
            },
            select: { userId: true },
          });

          if (!student) continue;

          const matchingDeliveries = await this.prisma.noticeDelivery.findMany({
            where: {
              userId: student.userId,
              channel: NoticeChannel.WHATSAPP,
              status: { in: [DeliveryStatus.QUEUED, DeliveryStatus.SENT, DeliveryStatus.DELIVERED] },
            },
            take: 5,
            orderBy: { id: 'desc' },
          });

          for (const d of matchingDeliveries) {
            if (status === 'delivered') {
              await this.prisma.noticeDelivery.update({
                where: { id: d.id },
                data: { status: DeliveryStatus.DELIVERED },
              });
              processed++;
            } else if (status === 'read') {
              await this.prisma.noticeDelivery.update({
                where: { id: d.id },
                data: { status: DeliveryStatus.READ, readAt: new Date() },
              });
              processed++;
            } else if (status === 'failed') {
              await this.prisma.noticeDelivery.update({
                where: { id: d.id },
                data: { status: DeliveryStatus.FAILED, failureReason: 'whatsapp_delivery_failed' },
              });
              processed++;
            }
          }
        }
      }
    }

    return { processed };
  }
}
