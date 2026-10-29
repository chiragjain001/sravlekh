import { DeliveryStatus, NoticeChannel } from '@prisma/client';
import { NoticeDispatchService } from './notice-dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendGridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { WhatsAppCloudApiAdapter } from './adapters/whatsapp-cloud.adapter';
import { SmsGatewayAdapter } from './adapters/sms-gateway.adapter';

describe('NoticeDispatchService', () => {
  let service: NoticeDispatchService;
  let prisma: {
    notice: { findUnique: jest.Mock; update: jest.Mock };
    noticeDelivery: { update: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
    user: { findMany: jest.Mock };
    studentProfile: { findFirst: jest.Mock };
  };
  let emailAdapter: Partial<SendGridEmailAdapter>;
  let whatsappAdapter: Partial<WhatsAppCloudApiAdapter>;
  let smsAdapter: Partial<SmsGatewayAdapter>;

  beforeEach(() => {
    prisma = {
      notice: { findUnique: jest.fn(), update: jest.fn() },
      noticeDelivery: { update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
      user: { findMany: jest.fn() },
      studentProfile: { findFirst: jest.fn() },
    };

    emailAdapter = {
      channel: NoticeChannel.EMAIL,
      providerName: 'SendGrid',
      isConfigured: jest.fn().mockReturnValue(true),
      validateConfiguration: jest.fn().mockReturnValue({ configured: true, missing: [] }),
      checkHealth: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 50 }),
      send: jest.fn().mockResolvedValue({ status: DeliveryStatus.SENT, externalId: 'msg-1' }),
    };

    whatsappAdapter = {
      channel: NoticeChannel.WHATSAPP,
      providerName: 'WhatsApp Cloud API',
      isConfigured: jest.fn().mockReturnValue(true),
      validateConfiguration: jest.fn().mockReturnValue({ configured: true, missing: [] }),
      checkHealth: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 60 }),
      send: jest.fn().mockResolvedValue({ status: DeliveryStatus.SENT, externalId: 'wamid-1' }),
    };

    smsAdapter = {
      channel: NoticeChannel.SMS,
      providerName: 'SMS Gateway',
      isConfigured: jest.fn().mockReturnValue(true),
      validateConfiguration: jest.fn().mockReturnValue({ configured: true, missing: [] }),
      checkHealth: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 40 }),
      send: jest.fn().mockResolvedValue({ status: DeliveryStatus.SENT, externalId: 'sms-1' }),
    };

    service = new NoticeDispatchService(
      prisma as unknown as PrismaService,
      emailAdapter as SendGridEmailAdapter,
      whatsappAdapter as WhatsAppCloudApiAdapter,
      smsAdapter as SmsGatewayAdapter,
    );
  });

  describe('dispatchNotice', () => {
    it('is idempotent: skips already sent/delivered rows and handles empty queue gracefully', async () => {
      prisma.notice.findUnique.mockResolvedValueOnce({
        id: 'n-1',
        instituteId: 'inst-1',
        title: 'Title',
        body: 'Body',
        deliveries: [], // 0 queued deliveries left (e.g. on BullMQ retry)
      });

      const summary = await service.dispatchNotice('n-1');
      expect(summary.totalQueued).toBe(0);
      expect(summary.sentCount).toBe(0);
      expect(emailAdapter.send).not.toHaveBeenCalled();
    });

    it('enforces cross-tenant recipient isolation', async () => {
      prisma.notice.findUnique.mockResolvedValueOnce({
        id: 'n-1',
        instituteId: 'inst-1',
        title: 'Title',
        body: 'Body',
        sentAt: null,
        deliveries: [
          { id: 'del-1', userId: 'user-foreign', channel: NoticeChannel.EMAIL, status: DeliveryStatus.QUEUED },
        ],
      });

      // Recipient lookup strictly filters by instituteId: 'inst-1'
      // user-foreign belongs to inst-2, so user.findMany returns empty
      prisma.user.findMany.mockResolvedValueOnce([]);

      const summary = await service.dispatchNotice('n-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['user-foreign'] },
          instituteId: 'inst-1',
        },
        select: expect.any(Object),
      });

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: {
          status: DeliveryStatus.FAILED,
          failureReason: 'cross_tenant_isolation_violation',
        },
      });
      expect(summary.failedCount).toBe(1);
      expect(emailAdapter.send).not.toHaveBeenCalled();
    });

    it('marks delivery as FAILED: provider_not_configured when channel adapter is not configured', async () => {
      (emailAdapter.isConfigured as jest.Mock).mockReturnValue(false);

      prisma.notice.findUnique.mockResolvedValueOnce({
        id: 'n-1',
        instituteId: 'inst-1',
        title: 'Title',
        body: 'Body',
        sentAt: null,
        deliveries: [
          { id: 'del-1', userId: 'user-1', channel: NoticeChannel.EMAIL, status: DeliveryStatus.QUEUED },
        ],
      });

      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', email: 'u1@inst.edu', name: 'User 1', studentProfile: null },
      ]);

      const summary = await service.dispatchNotice('n-1');

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: {
          status: DeliveryStatus.FAILED,
          failureReason: 'provider_not_configured',
        },
      });
      expect(summary.failedCount).toBe(1);
      expect(emailAdapter.send).not.toHaveBeenCalled();
    });

    it('successfully dispatches email and updates delivery to SENT', async () => {
      prisma.notice.findUnique.mockResolvedValueOnce({
        id: 'n-1',
        instituteId: 'inst-1',
        title: 'Holiday Notice',
        body: 'School closed tomorrow.',
        sentAt: null,
        deliveries: [
          { id: 'del-1', userId: 'user-1', channel: NoticeChannel.EMAIL, status: DeliveryStatus.QUEUED },
        ],
      });

      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', email: 'parent@home.com', name: 'Parent', studentProfile: null },
      ]);

      const summary = await service.dispatchNotice('n-1');

      expect(emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientContact: 'parent@home.com',
          title: 'Holiday Notice',
        }),
      );

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: expect.objectContaining({
          status: DeliveryStatus.SENT,
          failureReason: null,
        }),
      });
      expect(prisma.notice.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { sentAt: expect.any(Date) },
      });
      expect(summary.sentCount).toBe(1);
    });

    it('isolates failures: one recipient failure does not prevent other recipients from receiving notice', async () => {
      prisma.notice.findUnique.mockResolvedValueOnce({
        id: 'n-1',
        instituteId: 'inst-1',
        title: 'Notice',
        body: 'Text',
        sentAt: null,
        deliveries: [
          { id: 'del-1', userId: 'user-1', channel: NoticeChannel.SMS, status: DeliveryStatus.QUEUED },
          { id: 'del-2', userId: 'user-2', channel: NoticeChannel.SMS, status: DeliveryStatus.QUEUED },
        ],
      });

      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', email: 'u1@x.com', name: 'U1', studentProfile: { guardianPhone: '9876543210' } },
        { id: 'user-2', email: 'u2@x.com', name: 'U2', studentProfile: { guardianPhone: '9876543211' } },
      ]);

      // First SMS fails due to rate limit, second succeeds
      (smsAdapter.send as jest.Mock)
        .mockResolvedValueOnce({ status: DeliveryStatus.FAILED, failureReason: 'provider_rate_limited' })
        .mockResolvedValueOnce({ status: DeliveryStatus.SENT, externalId: 'sms-2' });

      const summary = await service.dispatchNotice('n-1');

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: { status: DeliveryStatus.FAILED, failureReason: 'provider_rate_limited' },
      });
      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del-2' },
        data: expect.objectContaining({ status: DeliveryStatus.SENT }),
      });

      expect(summary.sentCount).toBe(1);
      expect(summary.failedCount).toBe(1);
    });
  });

  describe('webhooks', () => {
    it('processes SendGrid delivered and bounce events', async () => {
      const events = [
        { deliveryId: 'del-1', event: 'delivered' },
        { deliveryId: 'del-2', event: 'bounce', reason: '550 Mailbox full' },
      ];

      const res = await service.handleSendGridWebhook(events);
      expect(res.processed).toBe(2);

      expect(prisma.noticeDelivery.updateMany).toHaveBeenCalledWith({
        where: { id: 'del-1', status: { not: DeliveryStatus.READ } },
        data: { status: DeliveryStatus.DELIVERED },
      });

      expect(prisma.noticeDelivery.updateMany).toHaveBeenCalledWith({
        where: { id: 'del-2' },
        data: { status: DeliveryStatus.FAILED, failureReason: 'bounced_550 Mailbox full' },
      });
    });

    it('processes WhatsApp delivered receipts', async () => {
      prisma.studentProfile.findFirst.mockResolvedValueOnce({ userId: 'u-1' });
      prisma.noticeDelivery.findMany.mockResolvedValueOnce([{ id: 'del-wa-1' }]);

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: 'wamid.123', status: 'delivered', recipient_id: '919876543210' }],
                },
              },
            ],
          },
        ],
      };

      const res = await service.handleWhatsAppWebhook(payload);
      expect(res.processed).toBe(1);
      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del-wa-1' },
        data: { status: DeliveryStatus.DELIVERED },
      });
    });
  });
});
