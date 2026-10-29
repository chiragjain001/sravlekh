import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface BookletPayload {
  v: number;
  inst: string;
  del: string;
  num: number;
  bkl: string;
  kid: string;
}

export interface VerifiedBookletQr {
  payload: BookletPayload;
  isValid: boolean;
}

@Injectable()
export class BookletSecurityService {
  private readonly logger = new Logger(BookletSecurityService.name);
  private readonly activeKeyId: string = 'k1';
  private readonly keyRing: Map<string, string> = new Map();

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.config.get<string>('NODE_ENV') || 'development';
    const aiosEnv = this.config.get<string>('AIOS_ENV');
    const isProductionLike = nodeEnv === 'production' || aiosEnv === 'staging';

    const singleKey = this.config.get<string>('BOOKLET_QR_SIGNING_KEY');
    if (!singleKey) {
      if (isProductionLike) {
        throw new Error(
          'FATAL: BOOKLET_QR_SIGNING_KEY is not configured in production/staging environment. ' +
          'Refusing to initialize BookletSecurityService without a cryptographic signing key.',
        );
      }
      this.logger.warn(
        'WARNING: BOOKLET_QR_SIGNING_KEY is not set. Using dev-only ephemeral key. DO NOT USE IN PRODUCTION.',
      );
      this.keyRing.set('k1', 'dev_only_ephemeral_booklet_qr_signing_key_32chars_min');
    } else {
      if (isProductionLike && singleKey.length < 32) {
        throw new Error(
          'FATAL: BOOKLET_QR_SIGNING_KEY must be at least 32 characters in production/staging.',
        );
      }
      this.keyRing.set('k1', singleKey);
    }

    // Support additional rotated keys if defined as JSON (e.g. {"k1": "key1", "k2": "key2"})
    const rawKeyRing = this.config.get<string>('BOOKLET_QR_SIGNING_KEYRING');
    if (rawKeyRing) {
      try {
        const parsed = JSON.parse(rawKeyRing);
        for (const [kid, key] of Object.entries(parsed)) {
          if (typeof key === 'string') {
            this.keyRing.set(kid, key);
          }
        }
      } catch (err) {
        this.logger.warn('Failed to parse BOOKLET_QR_SIGNING_KEYRING JSON', err as Error);
      }
    }
  }

  getActiveKeyId(): string {
    return this.activeKeyId;
  }

  /**
   * Generates a signed canonical QR string for an answer booklet.
   * Format: AIOS:V1:{kid}:{inst}:{del}:{num}:{bkl}:{sig}
   */
  signBooklet(params: { instituteId: string; deliveryId: string; numericSerial: number; bookletSerial: string; keyId?: string }): {
    qrString: string;
    signature: string;
    keyId: string;
  } {
    const kid = params.keyId || this.activeKeyId;
    const secret = this.keyRing.get(kid);
    if (!secret) {
      throw new Error(`Signing key with ID '${kid}' not found in key ring.`);
    }

    const canonicalData = this.buildCanonicalString(1, params.instituteId, params.deliveryId, params.numericSerial, params.bookletSerial, kid);
    const signature = crypto.createHmac('sha256', secret).update(canonicalData).digest('hex');

    const qrString = `AIOS:V1:${kid}:${params.instituteId}:${params.deliveryId}:${params.numericSerial}:${params.bookletSerial}:${signature}`;
    return { qrString, signature, keyId: kid };
  }

  /**
   * Parses and cryptographically verifies an incoming QR string in constant-time.
   */
  verifyBookletQr(qrString: string): VerifiedBookletQr {
    if (!qrString || typeof qrString !== 'string') {
      throw new BadRequestException('QR payload string is required.');
    }

    const parts = qrString.trim().split(':');
    if (parts.length !== 8 || parts[0] !== 'AIOS' || parts[1] !== 'V1') {
      throw new BadRequestException('Invalid QR code format or unsupported specification version.');
    }

    const kid = parts[2];
    const inst = parts[3];
    const del = parts[4];
    const numStr = parts[5];
    const bkl = parts[6];
    const signature = parts[7];

    if (!kid || !inst || !del || !numStr || !bkl || !signature) {
      throw new BadRequestException('Incomplete fields in QR payload.');
    }

    if (!/^[0-9a-fA-F]{64}$/.test(signature)) {
      throw new BadRequestException('Invalid signature format: HMAC-SHA256 signature must be 64 hexadecimal characters.');
    }

    const num = parseInt(numStr, 10);
    if (isNaN(num) || num <= 0 || !/^\d+$/.test(numStr)) {
      throw new BadRequestException('Corrupted numeric serial in QR payload.');
    }

    const secret = this.keyRing.get(kid);
    if (!secret) {
      this.logger.warn(`Unknown key ID in QR code: ${kid}`);
      throw new UnauthorizedException('Unknown or expired booklet signing key ID.');
    }

    const canonicalData = this.buildCanonicalString(1, inst, del, num, bkl, kid);
    const expectedSignature = crypto.createHmac('sha256', secret).update(canonicalData).digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn(`HMAC signature verification failed for booklet serial ${bkl}`);
      throw new UnauthorizedException('Cryptographic signature verification failed for booklet QR code.');
    }

    return {
      isValid: true,
      payload: {
        v: 1,
        inst,
        del,
        num,
        bkl,
        kid,
      },
    };
  }

  private buildCanonicalString(v: number, inst: string, del: string, num: number, bkl: string, kid: string): string {
    return `v=${v}&inst=${inst}&del=${del}&num=${num}&bkl=${bkl}&kid=${kid}`;
  }
}
