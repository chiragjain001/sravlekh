import { ConfigService } from '@nestjs/config';
import { DeliveryStatus } from '@prisma/client';
import axios from 'axios';
import { SmsGatewayAdapter } from './sms-gateway.adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SmsGatewayAdapter', () => {
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
    recipientContact: '9876543210',
    recipientName: 'Guardian',
    title: 'Emergency Notice',
    body: 'Heavy rain alert: institute closed today.',
  };

  it('fails honestly when SMS_GATEWAY_KEY is unconfigured', async () => {
    const adapter = new SmsGatewayAdapter(mockConfigService as ConfigService);
    expect(adapter.isConfigured()).toBe(false);

    const validation = adapter.validateConfiguration();
    expect(validation.configured).toBe(false);
    expect(validation.missing).toContain('SMS_GATEWAY_KEY');

    const result = await adapter.send(validOptions);
    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_not_configured');
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('rejects invalid mobile numbers before dispatching', async () => {
    configMap['SMS_GATEWAY_KEY'] = 'sms-key-123';

    const adapter = new SmsGatewayAdapter(mockConfigService as ConfigService);
    const result = await adapter.send({
      ...validOptions,
      recipientContact: '555',
    });

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('invalid_contact_info');
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('successfully delivers SMS via gateway with sender and DLT template formatting', async () => {
    configMap['SMS_GATEWAY_KEY'] = 'sms-secret-key';
    configMap['SMS_SENDER_ID'] = 'SCHOLL';
    configMap['SMS_DLT_TEMPLATE_ID'] = 'DLT-110712345';

    mockHttpClient.post.mockResolvedValueOnce({
      status: 200,
      data: { message_id: 'sms-msg-999888' },
    });

    const adapter = new SmsGatewayAdapter(mockConfigService as ConfigService);
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.send(validOptions);
    expect(result.status).toBe(DeliveryStatus.SENT);
    expect(result.externalId).toBe('sms-msg-999888');

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sender: 'SCHOLL',
        mobiles: '919876543210',
        dlt_template_id: 'DLT-110712345',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          authkey: 'sms-secret-key',
        }),
      }),
    );
  });

  it('handles gateway authentication failures (401)', async () => {
    configMap['SMS_GATEWAY_KEY'] = 'bad-key';

    mockHttpClient.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid authkey' } },
      message: 'Request failed with status code 401',
    });

    const adapter = new SmsGatewayAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_authentication_failed');
  });

  it('handles gateway rate limits (429)', async () => {
    configMap['SMS_GATEWAY_KEY'] = 'key';

    mockHttpClient.post.mockRejectedValueOnce({
      response: { status: 429, data: { message: 'Throughput exceeded' } },
      message: 'Request failed with status code 429',
    });

    const adapter = new SmsGatewayAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_rate_limited');
  });

  it('handles gateway timeout', async () => {
    configMap['SMS_GATEWAY_KEY'] = 'key';

    mockHttpClient.post.mockRejectedValueOnce({
      code: 'ECONNABORTED',
      message: 'timeout of 5000ms exceeded',
    });

    const adapter = new SmsGatewayAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_timeout');
  });
});
