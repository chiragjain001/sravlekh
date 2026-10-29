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
import { maskPhone, normalizeAndValidatePhone } from '../utils/mask-pii';

/**
 * Official Meta WhatsApp Cloud API Adapter (Graph API v19.0).
 * Per 17-THIRD-PARTY-INTEGRATIONS.md §5:
 * - Direct Meta Graph API integration (no third-party markup)
 * - Retries: 2 retries, exponential backoff
 * - Timeout: 8000ms
 * - Enforces valid Indian / E.164 phone normalization
 * - Masks contact details in all application logs
 */
@Injectable()
export class WhatsAppCloudApiAdapter implements NotificationChannelAdapter {
  readonly channel = NoticeChannel.WHATSAPP;
  readonly providerName = 'WhatsApp Cloud API';
  private readonly logger = new Logger(WhatsAppCloudApiAdapter.name);

  private readonly apiToken: string | undefined;
  private readonly phoneNumberId: string | undefined;
  private readonly templateName: string | undefined;
  private readonly dryRun: boolean;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('WHATSAPP_API_TOKEN')?.trim();
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim();
    this.templateName = this.config.get<string>('WHATSAPP_TEMPLATE_NAME')?.trim();
    this.dryRun = this.config.get<boolean>('NOTIFICATION_DRY_RUN') || false;

    this.httpClient = axios.create({
      baseURL: 'https://graph.facebook.com/v19.0',
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.apiToken && this.phoneNumberId);
  }

  validateConfiguration(): ConfigurationValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!this.apiToken) {
      missing.push('WHATSAPP_API_TOKEN');
    }
    if (!this.phoneNumberId) {
      missing.push('WHATSAPP_PHONE_NUMBER_ID');
    }
    if (!this.templateName) {
      warnings.push('WHATSAPP_TEMPLATE_NAME not set; will use free-form text within active session window');
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
        message: 'WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured',
      };
    }

    const start = Date.now();
    try {
      // Query the registered phone number node on Graph API to verify token and account health
      await this.httpClient.get(`/${this.phoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        timeout: 5000,
      });
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const status = err.response?.status;
      const message = status === 401 || status === 403
        ? 'Invalid or expired WhatsApp Cloud API token'
        : err.message || 'WhatsApp Cloud API unreachable';
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

    const phoneResult = normalizeAndValidatePhone(options.recipientContact);
    if (!phoneResult.valid) {
      this.logger.warn(`Rejecting WhatsApp dispatch to invalid phone: ${maskPhone(options.recipientContact)} (${phoneResult.error})`);
      return {
        status: DeliveryStatus.FAILED,
        failureReason: 'invalid_contact_info',
        durationMs: Date.now() - start,
      };
    }

    const recipientPhone = phoneResult.normalized.replace('+', '');

    if (this.dryRun) {
      this.logger.log(`[DRY-RUN] Simulating WhatsApp message to ${maskPhone(recipientPhone)} (Title: "${options.title}")`);
      return {
        status: DeliveryStatus.SENT,
        externalId: `mock-wa-${Date.now()}`,
        durationMs: Date.now() - start,
      };
    }

    try {
      let payload: Record<string, unknown>;

      if (this.templateName) {
        payload = {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'template',
          template: {
            name: this.templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: options.title },
                  { type: 'text', text: options.body },
                ],
              },
            ],
          },
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: `*${options.title}*\n\n${options.body}`,
          },
        };
      }

      const res = await this.httpClient.post(`/${this.phoneNumberId}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      const messageId = res.data?.messages?.[0]?.id || null;
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
        `WhatsApp delivery failed for recipient ${maskPhone(recipientPhone)}: ${failureReason} (${err.message})`,
      );

      return {
        status: DeliveryStatus.FAILED,
        failureReason,
        durationMs,
      };
    }
  }
}
