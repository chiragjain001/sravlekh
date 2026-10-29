import { ConfigService } from '@nestjs/config';
import { DeliveryStatus } from '@prisma/client';
import axios from 'axios';
import { SendGridEmailAdapter } from './sendgrid-email.adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SendGridEmailAdapter', () => {
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
    recipientContact: 'student@example.com',
    recipientName: 'Student Name',
    title: 'School Circular',
    body: 'School remains closed on Monday.',
  };

  it('fails honestly when SENDGRID_API_KEY is missing', async () => {
    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    expect(adapter.isConfigured()).toBe(false);

    const validation = adapter.validateConfiguration();
    expect(validation.configured).toBe(false);
    expect(validation.missing).toContain('SENDGRID_API_KEY');

    const result = await adapter.send(validOptions);
    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_not_configured');
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('fails immediately when recipient email is invalid RFC format', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.valid-key-123';
    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);

    const result = await adapter.send({
      ...validOptions,
      recipientContact: 'invalid-email-address',
    });

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('invalid_contact_info');
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('successfully delivers email via SendGrid v3 API returning SENT status', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.valid-key-123';
    configMap['SENDGRID_FROM_EMAIL'] = 'admin@school.com';
    configMap['SENDGRID_FROM_NAME'] = 'DPS Notice Desk';

    mockHttpClient.post.mockResolvedValueOnce({
      status: 202,
      headers: { 'x-message-id': 'sg-msg-12345' },
    });

    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.send(validOptions);
    expect(result.status).toBe(DeliveryStatus.SENT);
    expect(result.externalId).toBe('sg-msg-12345');
    expect(mockHttpClient.post).toHaveBeenCalledWith(
      '/v3/mail/send',
      expect.objectContaining({
        subject: 'School Circular',
        from: { email: 'admin@school.com', name: 'DPS Notice Desk' },
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer SG.valid-key-123' },
      }),
    );
  });

  it('handles provider authentication failure (401)', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.bad-key';
    mockHttpClient.post.mockRejectedValueOnce({
      response: { status: 401, data: { errors: [{ message: 'Bad API key' }] } },
      message: 'Request failed with status code 401',
    });

    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_authentication_failed');
  });

  it('handles provider rate limits (429)', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.valid-key';
    mockHttpClient.post.mockRejectedValueOnce({
      response: { status: 429, data: { errors: [{ message: 'Too many requests' }] } },
      message: 'Request failed with status code 429',
    });

    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_rate_limited');
  });

  it('handles network timeouts gracefully', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.valid-key';
    mockHttpClient.post.mockRejectedValueOnce({
      code: 'ECONNABORTED',
      message: 'timeout of 5000ms exceeded',
    });

    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.FAILED);
    expect(result.failureReason).toBe('provider_timeout');
  });

  it('supports safe dry-run mode without external network requests', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.valid-key';
    configMap['NOTIFICATION_DRY_RUN'] = true;

    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    const result = await adapter.send(validOptions);

    expect(result.status).toBe(DeliveryStatus.SENT);
    expect(result.externalId).toMatch(/^mock-sg-/);
    expect(mockHttpClient.post).not.toHaveBeenCalled();
  });

  it('reports health check status accurately', async () => {
    configMap['SENDGRID_API_KEY'] = 'SG.valid-key';
    mockHttpClient.get.mockResolvedValueOnce({ status: 200 });

    const adapter = new SendGridEmailAdapter(mockConfigService as ConfigService);
    const health = await adapter.checkHealth();

    expect(health.status).toBe('up');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
