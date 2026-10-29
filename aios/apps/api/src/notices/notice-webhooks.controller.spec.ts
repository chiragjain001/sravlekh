import { NoticeWebhooksController } from './notice-webhooks.controller';
import { NoticeDispatchService } from './notice-dispatch.service';

describe('NoticeWebhooksController', () => {
  let controller: NoticeWebhooksController;
  let dispatchService: {
    handleSendGridWebhook: jest.Mock;
    handleWhatsAppWebhook: jest.Mock;
  };

  beforeEach(() => {
    dispatchService = {
      handleSendGridWebhook: jest.fn().mockResolvedValue({ processed: 2 }),
      handleWhatsAppWebhook: jest.fn().mockResolvedValue({ processed: 1 }),
    };
    controller = new NoticeWebhooksController(dispatchService as unknown as NoticeDispatchService);
  });

  it('delegates SendGrid event webhooks to dispatch service', async () => {
    const events = [{ event: 'delivered', deliveryId: 'd-1' }];
    const result = await controller.handleSendGridWebhook(events);

    expect(dispatchService.handleSendGridWebhook).toHaveBeenCalledWith(events);
    expect(result).toEqual({ processed: 2 });
  });

  it('responds with Meta challenge for WhatsApp webhook subscription verification', () => {
    const challenge = 'challenge_123456';
    const res = controller.verifyWhatsAppWebhook('subscribe', 'token', challenge);
    expect(res).toBe('challenge_123456');
  });

  it('delegates WhatsApp webhook status updates to dispatch service', async () => {
    const body = { entry: [] };
    const result = await controller.handleWhatsAppWebhook(body);

    expect(dispatchService.handleWhatsAppWebhook).toHaveBeenCalledWith(body);
    expect(result).toEqual({ processed: 1 });
  });
});
