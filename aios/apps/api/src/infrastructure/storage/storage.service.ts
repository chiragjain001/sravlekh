import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, normalize, resolve, sep } from 'path';
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

  /**
   * Dev-only fallback. Without S3 configured, every upload threw a bare Error
   * that escaped as a 500, so a student clicking "Submit Work" locally got an
   * opaque crash and their homework was never stored. Outside production we
   * write to disk and hand back an HMAC-signed, short-lived URL — the same
   * self-authenticating contract as an S3 presigned link, so nothing else in
   * the app has to know which driver is active. Never used in production: there,
   * missing configuration is a deployment fault and says so.
   */
  private readonly localRoot: string | null;
  private readonly urlSecret: string;
  private readonly publicApiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET');
    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    this.configured = Boolean(this.bucket && region && accessKeyId && secretAccessKey);
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    this.urlSecret = this.config.get<string>('JWT_SECRET') ?? 'local-storage-dev-secret';
    this.publicApiUrl = this.config.get<string>('PUBLIC_API_URL') ?? `http://localhost:${this.config.get<string>('PORT') ?? 4000}`;
    this.localRoot = !this.configured && !isProduction
      ? resolve(process.cwd(), this.config.get<string>('LOCAL_STORAGE_DIR') ?? '.local-storage')
      : null;

    if (!this.configured) {
      this.logger.warn(
        this.localRoot
          ? `S3 is not configured — falling back to local disk at ${this.localRoot}. Development only; set S3_BUCKET/AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for anything real.`
          : 'S3 storage is not fully configured (S3_BUCKET/AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) — upload/signed-URL calls will fail until it is.',
      );
    }

    this.client = new S3Client({
      region: region ?? 'ap-south-1',
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  /** True when uploads are being written to local disk instead of S3. */
  isLocalFallbackActive(): boolean {
    return this.localRoot !== null;
  }

  /**
   * Resolves a storage key to a path inside the local root, refusing anything
   * that escapes it — keys reach this from request data, so `../` must not walk
   * out of the storage directory.
   */
  private localPathFor(key: string): string {
    if (!this.localRoot) throw new Error('Local storage fallback is not active.');
    const full = resolve(this.localRoot, normalize(key));
    if (full !== this.localRoot && !full.startsWith(this.localRoot + sep)) {
      throw new ServiceUnavailableException('Invalid storage key.');
    }
    return full;
  }

  private sign(key: string, expiresAt: number): string {
    return createHmac('sha256', this.urlSecret).update(`${key}:${expiresAt}`).digest('hex');
  }

  /** Verifies a local signed URL. Returns the file only when signature and expiry both hold. */
  async readLocalSigned(key: string, expiresAt: number, signature: string): Promise<Buffer> {
    if (!this.localRoot) throw new ServiceUnavailableException('Local storage is not active.');
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      throw new ServiceUnavailableException('This download link has expired.');
    }
    const expected = Buffer.from(this.sign(key, expiresAt));
    const given = Buffer.from(signature ?? '');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new ServiceUnavailableException('Invalid download link.');
    }
    return fs.readFile(this.localPathFor(key));
  }

  /** Builds a tenant-scoped key. Always route storage keys through this — never hand-build one. */
  buildKey(instituteId: string, ...segments: string[]): string {
    return ['institutes', instituteId, ...segments].join('/');
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.localRoot) {
      const path = this.localPathFor(key);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, body);
      await fs.writeFile(`${path}.meta`, contentType, 'utf8');
      return;
    }
    this.assertConfigured();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Time-limited signed URL — files are never served from a public/unsigned path (07-SECURITY-SPECIFICATION.md). */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    if (this.localRoot) {
      const expiresAt = Date.now() + expiresInSeconds * 1000;
      const q = new URLSearchParams({ key, exp: String(expiresAt), sig: this.sign(key, expiresAt) });
      return `${this.publicApiUrl}/api/v1/files/local?${q.toString()}`;
    }
    this.assertConfigured();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    if (this.localRoot) {
      const path = this.localPathFor(key);
      await fs.rm(path, { force: true });
      await fs.rm(`${path}.meta`, { force: true });
      return;
    }
    this.assertConfigured();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async localContentType(key: string): Promise<string> {
    try {
      return (await fs.readFile(`${this.localPathFor(key)}.meta`, 'utf8')) || 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }

  private assertConfigured(): void {
    if (!this.configured) {
      // A missing bucket is a deployment fault, not a bug in the caller's
      // request — 503 with the cause beats an opaque 500 that reads as a crash.
      throw new ServiceUnavailableException(
        'File storage is not configured on this server, so uploads and downloads are unavailable. Set S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.',
      );
    }
  }

  /** Founder Console Phase 7 (integrations registry) — never exposes the credentials themselves. */
  isConfigured(): boolean {
    return this.configured;
  }
}
