import { DeliveryStatus, NoticeChannel } from '@prisma/client';

export interface SendNotificationOptions {
  instituteId: string;
  noticeId: string;
  deliveryId: string;
  recipientId: string;
  recipientContact: string; // email address or phone number
  recipientName?: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SendNotificationResult {
  status: DeliveryStatus;
  failureReason?: string | null;
  externalId?: string | null;
  durationMs?: number;
}

export interface ProviderHealthCheckResult {
  status: 'up' | 'down';
  latencyMs: number | null;
  message?: string;
}

export interface ConfigurationValidationResult {
  configured: boolean;
  missing: string[];
  warnings?: string[];
}

export interface NotificationChannelAdapter {
  readonly channel: NoticeChannel;
  readonly providerName: string;

  /** Whether the provider has the minimal configuration credentials present to attempt delivery. */
  isConfigured(): boolean;

  /** Inspects environment configuration and returns missing keys or setup guidance. */
  validateConfiguration(): ConfigurationValidationResult;

  /** Performs an explicit connectivity/auth health-check against the provider endpoint. */
  checkHealth(): Promise<ProviderHealthCheckResult>;

  /**
   * Dispatches a single notification message using the official provider REST contract.
   * Safe, non-throwing: returns SendNotificationResult with honest status & reason.
   */
  send(options: SendNotificationOptions): Promise<SendNotificationResult>;
}
