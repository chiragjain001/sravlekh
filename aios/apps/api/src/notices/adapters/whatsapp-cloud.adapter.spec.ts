import { ConfigService } from '@nestjs/config';
import { DeliveryStatus } from '@prisma/client';
import axios from 'axios';
import { WhatsAppCloudApiAdapter } from './whatsapp-cloud.adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WhatsAppCloudApiAdapter', () => {
  let configMap: Record<string, any>;
  let mockConfigService: Partial<ConfigService>;
  let mockHttpClient: { post: jest.Mock; get: jest.Mock };

  beforeEach(() => {
    configMap = {};
    mockConfigService = {
      get: jest.fn((key: string) => configMap[key]),
    };
    mockHttpClient = {
      post: jest.fn(),
      get: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockHttpClient as any);
  });

  const validOptions = {
    instituteId: 'inst-1',
    noticeId: 'notice-1',
    deliveryId: 'del-1',
    recipientId: 'user-1',
    recipientContact: '9876543210', // Valid Indian mobile
    recipientName: 'Guardian Name',
    title: 'Exam Schedule',
    body: 'Unit tests start from Friday.',
  };

  it('fails honestly when credentials are unconfigured', async () => {
    const adapter = new WhatsAppCloudApiAdapter(mockConfigService as ConfigService);
    expect(adapter.isConfigured()).toBe(false);

    const validation = adapter.validateConfiguration();
    expect(validation.configured).toBe(false);
    expect(validation.missing).toContain('WHATSAPP_API_TOKEN');
    expect(validation.missing).toContain('WHATSAPP_PHONE_NUMBER_ID');

    const result = await adapter.send(validOptions);
    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_not_configured');
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('rejects invalid mobile numbers before calling Meta Graph API', async () => {
    configMap['WHATSAPP_API_TOKEN'] = 'wa-token';
    configMap['WHATSAPP_PHONE_NUMBER_ID'] = '109823471923';

    const adapter = new WhatsAppCloudApiAdapter(mockConfigService as ConfigService);
    const result = await adapter.send({
      ...validOptions,
      recipientContact: '000-invalid',
    });

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('invalid_contact_info');
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('successfully dispatches message via Meta Graph API with phone normalization', async () => {
    configMap['WHATSAPP_API_TOKEN'] = 'wa-token-123';
    configMap['WHATSAPP_PHONE_NUMBER_ID'] = '109823471923';

    mockHttpClient.post.mockResolvedValueOnce({
      status: 200,
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '919876543210', wa_id: '919876543210' }],
        messages: [{ id: 'wamid.HBgLMTIzNDU=' }],
      },
    });

    const adapter = new WhatsAppCloudApiAdapter(mockConfigService as ConfigService);
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.send(validOptions);
    expect(result.status).toBe(DeliveryStatus.SENT);
    expect(result.externalId).toBe('wamid.HBgLMTIzNDU=');

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      '/109823471923/messages',
      expect.objectContaining({
        messaging_product: 'whatsapp',
        to: '919876543210',
        text: expect.objectContaining({
          body: '*Exam Schedule*\n\nUnit tests start from Friday.',
        }),
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer wa-token-123' },
      }),
    );
  });

  it('handles Meta 401 token authentication errors', async () => {
    configMap['WHATSAPP_API_TOKEN'] = 'expired-token';
    configMap['WHATSAPP_PHONE_NUMBER_ID'] = '109823471923';

    mockHttpClient.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: { message: 'Session expired' } } },
      message: 'Request failed with status code 401',
    });

    const adapter = new WhatsAppCloudApiAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_authentication_failed');
  });

  it('handles Meta 429 rate limit errors', async () => {
    configMap['WHATSAPP_API_TOKEN'] = 'token';
    configMap['WHATSAPP_PHONE_NUMBER_ID'] = '109823471923';

    mockHttpClient.post.mockRejectedValueOnce({
      response: { status: 429, data: { error: { message: 'Rate limit exceeded' } } },
      message: 'Request failed with status code 429',
    });

    const adapter = new WhatsAppCloudApiAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_rate_limited');
  });

  it('handles timeout when Meta Graph API hangs', async () => {
    configMap['WHATSAPP_API_TOKEN'] = 'token';
    configMap['WHATSAPP_PHONE_NUMBER_ID'] = '109823471923';

    mockHttpClient.post.mockRejectedValueOnce({
      code: 'ECONNABORTED',
      message: 'timeout of 8000ms exceeded',
    });

    const adapter = new WhatsAppCloudApiAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_timeout');
  });
});
