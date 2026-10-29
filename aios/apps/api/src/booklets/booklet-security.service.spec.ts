import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { BookletSecurityService } from './booklet-security.service';

describe('BookletSecurityService', () => {
  let service: BookletSecurityService;
  const testSecret = 'test_secret_key_for_booklets_32_bytes_len';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookletSecurityService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'BOOKLET_QR_SIGNING_KEY') return testSecret;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<BookletSecurityService>(BookletSecurityService);
  });

  it('generates a signed canonical QR string', () => {
    const result = service.signBooklet({
      instituteId: 'inst-1',
      deliveryId: 'del-1',
      numericSerial: 42,
      bookletSerial: 'BKL-AAD-DEL1-0042',
    });

    expect(result.qrString).toContain('AIOS:V1:k1:inst-1:del-1:42:BKL-AAD-DEL1-0042:');
    expect(result.signature).toHaveLength(64); // SHA-256 hex digest
    expect(result.keyId).toBe('k1');
  });

  it('successfully verifies a valid signed QR string', () => {
    const { qrString } = service.signBooklet({
      instituteId: 'inst-1',
      deliveryId: 'del-1',
      numericSerial: 10,
      bookletSerial: 'BKL-AAD-DEL1-0010',
    });

    const verified = service.verifyBookletQr(qrString);
    expect(verified.isValid).toBe(true);
    expect(verified.payload.inst).toBe('inst-1');
    expect(verified.payload.del).toBe('del-1');
    expect(verified.payload.num).toBe(10);
    expect(verified.payload.bkl).toBe('BKL-AAD-DEL1-0010');
  });

  it('rejects tampered booklet serial', () => {
    const { qrString } = service.signBooklet({
      instituteId: 'inst-1',
      deliveryId: 'del-1',
      numericSerial: 10,
      bookletSerial: 'BKL-AAD-DEL1-0010',
    });

    // Tamper with serial in the payload
    const tampered = qrString.replace('BKL-AAD-DEL1-0010', 'BKL-AAD-DEL1-0099');
    expect(() => service.verifyBookletQr(tampered)).toThrow(UnauthorizedException);
  });

  it('rejects tampered delivery ID', () => {
    const { qrString } = service.signBooklet({
      instituteId: 'inst-1',
      deliveryId: 'del-1',
      numericSerial: 10,
      bookletSerial: 'BKL-AAD-DEL1-0010',
    });

    const tampered = qrString.replace(':del-1:', ':del-99:');
    expect(() => service.verifyBookletQr(tampered)).toThrow(UnauthorizedException);
  });

  it('rejects tampered signature', () => {
    const { qrString } = service.signBooklet({
      instituteId: 'inst-1',
      deliveryId: 'del-1',
      numericSerial: 10,
      bookletSerial: 'BKL-AAD-DEL1-0010',
    });

    const tampered = qrString.slice(0, -4) + 'ffff';
    expect(() => service.verifyBookletQr(tampered)).toThrow(UnauthorizedException);
  });

  it('rejects malformed QR string format', () => {
    expect(() => service.verifyBookletQr('random-garbage-string')).toThrow(BadRequestException);
    expect(() => service.verifyBookletQr('AIOS:V2:k1:bad')).toThrow(BadRequestException);
  });
});
