import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3-compatible object storage (07-SECURITY-SPECIFICATION.md / 23-DOCUMENT-PROCESSING-
 * ARCHITECTURE.md): every key MUST be prefixed `institutes/{instituteId}/...` so a
 * tenant's files are never reachable except through that tenant's own signed URLs.
 * Used today for nothing yet (no upload endpoint exists — see docs/33 gap analysis);
 * this is the shared client photo-capture/OMR/report-export endpoints will build on.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string | undefined;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    this.configured = Boolean(this.bucket && region && accessKeyId && secretAccessKey);
    if (!this.configured) {
      this.logger.warn(
        'S3 storage is not fully configured (S3_BUCKET/AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) — ' +
          'upload/signed-URL calls will fail until it is.',
      );
    }

    this.client = new S3Client({
      region: region ?? 'ap-south-1',
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  /** Builds a tenant-scoped key. Always route storage keys through this — never hand-build one. */
  buildKey(instituteId: string, ...segments: string[]): string {
    return ['institutes', instituteId, ...segments].join('/');
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Time-limited signed URL — files are never served from a public/unsigned path (07-SECURITY-SPECIFICATION.md). */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    this.assertConfigured();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new Error('StorageService is not configured — missing S3 env vars.');
    }
  }
}
