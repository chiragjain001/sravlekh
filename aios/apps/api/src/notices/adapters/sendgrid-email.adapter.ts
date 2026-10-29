import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryStatus, NoticeChannel } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import {
  NotificationChannelAdapter,
  SendNotificationOptions,
  SendNotificationResult,
  ProviderHealthCheckResult,
  ConfigurationValidationResult,
} from './notification-adapter.interface';
import { isValidEmail, maskEmail } from '../utils/mask-pii';

/**
 * Official SendGrid v3 Email Adapter.
 * Per 17-THIRD-PARTY-INTEGRATIONS.md §3:
 * - Endpoint: POST https://api.sendgrid.com/v3/mail/send
 * - Retries: 2 retries, exponential backoff (orchestrated at queue layer)
 * - Timeout: 5000ms
 * - Never logs raw student emails or API keys
 */
@Injectable()
export class SendGridEmailAdapter implements NotificationChannelAdapter {
  readonly channel = NoticeChannel.EMAIL;
  readonly providerName = 'SendGrid';
  private readonly logger = new Logger(SendGridEmailAdapter.name);

  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly dryRun: boolean;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SENDGRID_API_KEY')?.trim();
    this.fromEmail = this.config.get<string>('SENDGRID_FROM_EMAIL')?.trim() || 'notifications@aios.institute';
    this.fromName = this.config.get<string>('SENDGRID_FROM_NAME')?.trim() || 'AIOS Notice Center';
    this.dryRun = this.config.get<boolean>('NOTIFICATION_DRY_RUN') || false;

    this.httpClient = axios.create({
      baseURL: 'https://api.sendgrid.com',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  validateConfiguration(): ConfigurationValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!this.apiKey) {
      missing.push('SENDGRID_API_KEY');
    }
    if (!this.config.get<string>('SENDGRID_FROM_EMAIL')) {
      warnings.push(`SENDGRID_FROM_EMAIL not explicitly set; defaulting to ${this.fromEmail}`);
    }

    return {
      configured: missing.length === 0,
      missing,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  async checkHealth(): Promise<ProviderHealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        status: 'down',
        latencyMs: null,
        message: 'SENDGRID_API_KEY is not configured',
      };
    }

    const start = Date.now();
    try {
      // SendGrid scopes endpoint tests API key validity without sending an email
      await this.httpClient.get('/v3/scopes', {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 4000,
      });
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const status = err.response?.status;
      const message = status === 401 || status === 403
        ? 'Invalid or unauthorized SendGrid API key'
        : err.message || 'SendGrid API unreachable';
      return {
        status: 'down',
        latencyMs,
        message,
      };
    }
  }

  async send(options: SendNotificationOptions): Promise<SendNotificationResult> {
    const start = Date.now();

    if (!this.isConfigured()) {
      return {
        status: DeliveryStatus.FAILED,
        failureReason: 'provider_not_configured',
        durationMs: Date.now() - start,
      };
    }

    if (!isValidEmail(options.recipientContact)) {
      this.logger.warn(`Rejecting email dispatch to invalid address: ${maskEmail(options.recipientContact)}`);
      return {
        status: DeliveryStatus.FAILED,
        failureReason: 'invalid_contact_info',
        durationMs: Date.now() - start,
      };
    }

    if (this.dryRun) {
      this.logger.log(`[DRY-RUN] Simulating email send to ${maskEmail(options.recipientContact)} (Title: "${options.title}")`);
      return {
        status: DeliveryStatus.SENT,
        externalId: `mock-sg-${Date.now()}`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const payload = {
        personalizations: [
          {
            to: [
              {
                email: options.recipientContact,
                name: options.recipientName || undefined,
              },
            ],
            custom_args: {
              instituteId: options.instituteId,
              noticeId: options.noticeId,
              deliveryId: options.deliveryId,
            },
          },
        ],
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: options.title,
        content: [
          {
            type: 'text/plain',
            value: options.body,
          },
        ],
      };

      const res = await this.httpClient.post('/v3/mail/send', payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const messageId = (res.headers['x-message-id'] as string) || null;
      return {
        status: DeliveryStatus.SENT,
        externalId: messageId,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const status = err.response?.status;
      let failureReason = 'provider_rejected';

      if (status === 401 || status === 403) {
        failureReason = 'provider_authentication_failed';
      } else if (status === 429) {
        failureReason = 'provider_rate_limited';
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        failureReason = 'provider_timeout';
      }

      this.logger.error(
        `SendGrid delivery failed for recipient ${maskEmail(options.recipientContact)}: ${failureReason} (${err.message})`,
      );

      return {
        status: DeliveryStatus.FAILED,
        failureReason,
        durationMs,
      };
    }
  }
}
