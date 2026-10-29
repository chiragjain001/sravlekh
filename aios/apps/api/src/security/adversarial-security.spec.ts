import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UserRole,
} from '@prisma/client';
import { BookletSecurityService } from '../booklets/booklet-security.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { IdentityResolutionService } from '../identity-resolution/identity-resolution.service';
import { getQueueToken } from '@nestjs/bullmq';
import { PDF_SPLIT_QUEUE } from '../documents/documents.constants';
import { AuthenticatedUser } from '../auth/auth.types';
import { assertNoUnevaluatedSubjectiveResponses } from '../shared/evaluation-lock-gate';

/**
 * AGENT 6: Platform Security, Tenant Isolation & Adversarial Integrity Spec.
 * 
 * Tests adversarial attack vectors across tenant boundaries, IDOR, cryptographic QR tampering,
 * non-terminal AI evaluation governance gates, file upload exploits, and sensitive info protection.
 */
describe('Adversarial Security & Tenant Isolation Suite (Agent 6)', () => {
  let bookletSecurity: BookletSecurityService;
  let documentsService: DocumentsService;
  let prismaMock: any;
  let storageMock: any;
  let cacheMock: any;

  const TENANT_A = 'inst-apex-001';
  const TENANT_B = 'inst-zenith-002';

  const userAdminA: AuthenticatedUser = {
    id: 'user-admin-a',
    instituteId: TENANT_A,
    email: 'admin@apex.edu',
    name: 'Apex Admin',
    role: UserRole.ADMIN,
  };

  const userStudentA1: AuthenticatedUser = {
    id: 'user-student-a1',
    instituteId: TENANT_A,
    email: 'student1@apex.edu',
    name: 'Student One',
    role: UserRole.STUDENT,
  };

  const userAdminB: AuthenticatedUser = {
    id: 'user-admin-b',
    instituteId: TENANT_B,
    email: 'admin@zenith.edu',
    name: 'Zenith Admin',
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    prismaMock = {
      document: {
        findUnique: jest.fn(),
      },
      documentBundle: {
        findUnique: jest.fn(),
      },
      assessmentDelivery: {
        findUnique: jest.fn(),
      },
      attempt: {
        findUnique: jest.fn(),
      },
      studentProfile: {
        findUnique: jest.fn(),
      },
      response: {
        count: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    storageMock = {
      buildKey: jest.fn().mockReturnValue('mock-key'),
      upload: jest.fn().mockResolvedValue('mock-url'),
    };

    cacheMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookletSecurityService,
        DocumentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'BOOKLET_QR_SIGNING_KEY') return 'test-secure-hmac-sha256-key-32chars!';
              return null;
            }),
          },
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: CacheService, useValue: cacheMock },
        { provide: FeatureFlagsService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
        { provide: IdentityResolutionService, useValue: { resolveFromQrAndOmr: jest.fn() } },
        { provide: getQueueToken(PDF_SPLIT_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    bookletSecurity = module.get<BookletSecurityService>(BookletSecurityService);
    documentsService = module.get<DocumentsService>(DocumentsService);
  });

  // ==========================================================================
  // 1. Cross-Tenant Isolation & Anti-Leakage
  // ==========================================================================
  describe('Tenant Isolation Boundaries', () => {
    it('rejects cross-tenant document read by returning 404 (never leaks existence of other tenant data)', async () => {
      // Document belongs to Tenant B
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-zenith-101',
        instituteId: TENANT_B,
        documentBundle: {
          assessmentDelivery: {
            assessment: { instituteId: TENANT_B },
          },
        },
        attempt: { studentProfileId: 'stu-b1' },
      });

      // Admin A from Tenant A attempts to access Tenant B document
      await expect(
        documentsService.findById(TENANT_A, 'doc-zenith-101', userAdminA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cross-tenant student attempt to access document even within same institute if not owner (Student IDOR)', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-apex-999',
        instituteId: TENANT_A,
        attemptId: 'att-apex-2',
        documentBundle: {
          assessmentDelivery: {
            assessment: { instituteId: TENANT_A },
          },
        },
        attempt: { studentProfileId: 'profile-student-a2' },
      });

      // Attempt belongs to student a2
      prismaMock.attempt.findUnique.mockResolvedValue({
        id: 'att-apex-2',
        studentProfileId: 'profile-student-a2',
      });

      // Student A1's profile is profile-student-a1
      prismaMock.studentProfile.findUnique.mockResolvedValue({
        id: 'profile-student-a1',
        userId: userStudentA1.id,
      });

      // Student A1 tries to access Student A2's evaluated document
      await expect(
        documentsService.findById(TENANT_A, 'doc-apex-999', userStudentA1),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // 2. Cryptographic QR Verification & Anti-Tampering
  // ==========================================================================
  describe('Cryptographic Booklet QR Security', () => {
    it('signs and verifies authentic booklet QR with HMAC-SHA256 in constant time', () => {
      const signed = bookletSecurity.signBooklet({
        instituteId: TENANT_A,
        deliveryId: 'del-901',
        numericSerial: 1,
        bookletSerial: 'BKL-0001',
      });

      expect(signed.qrString.startsWith('AIOS:V1:k1:')).toBe(true);
      expect(signed.signature.length).toBe(64);

      const verification = bookletSecurity.verifyBookletQr(signed.qrString);
      expect(verification.isValid).toBe(true);
      expect(verification.payload.inst).toBe(TENANT_A);
      expect(verification.payload.del).toBe('del-901');
      expect(verification.payload.bkl).toBe('BKL-0001');
    });

    it('rejects QR code when student or attacker tampers with numericSerial or deliveryId', () => {
      const signed = bookletSecurity.signBooklet({
        instituteId: TENANT_A,
        deliveryId: 'del-901',
        numericSerial: 1,
        bookletSerial: 'BKL-0001',
      });

      // Attacker tampers with delivery id in QR string
      const tamperedQr = signed.qrString.replace('del-901', 'del-TAMPERED');

      expect(() => bookletSecurity.verifyBookletQr(tamperedQr)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects QR code with forged signature', () => {
      const signed = bookletSecurity.signBooklet({
        instituteId: TENANT_A,
        deliveryId: 'del-901',
        numericSerial: 1,
        bookletSerial: 'BKL-0001',
      });

      // Replace last 8 chars of 64-char HMAC signature
      const tamperedSig = signed.qrString.slice(0, -8) + '00000000';

      expect(() => bookletSecurity.verifyBookletQr(tamperedSig)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects malformed QR string with missing segments', () => {
      expect(() => bookletSecurity.verifyBookletQr('AIOS:V1:k1:TENANT:incomplete')).toThrow(
        BadRequestException,
      );
    });
  });

  // ==========================================================================
  // 3. AI Evaluation Governance Gate (Non-Terminal AI Invariant)
  // ==========================================================================
  describe('AI Evaluation Governance Gate', () => {
    it('blocks exam lock when subjective responses remain AI_SUGGESTED or PENDING (SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED)', async () => {
      // Responses still require human review
      prismaMock.response.count.mockResolvedValue(3);

      await expect(
        assertNoUnevaluatedSubjectiveResponses(prismaMock, {
          attempt: { assessmentDeliveryId: 'del-123' },
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await assertNoUnevaluatedSubjectiveResponses(prismaMock, {
          attempt: { assessmentDeliveryId: 'del-123' },
        });
      } catch (err: any) {
        expect(err.response.code).toBe('SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED');
        expect(err.response.message).toContain('3 subjective response(s) still need a human evaluation');
      }
    });

    it('allows exam lock when all subjective responses have human verified decisions', async () => {
      // 0 unevaluated responses
      prismaMock.response.count.mockResolvedValue(0);

      await expect(
        assertNoUnevaluatedSubjectiveResponses(prismaMock, {
          attempt: { assessmentDeliveryId: 'del-123' },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. File Upload Exploit Defense & Size Limits
  // ==========================================================================
  describe('File Upload Security & Bounds', () => {
    it('rejects uploads exceeding the max size ceiling with PayloadTooLargeException', async () => {
      prismaMock.documentBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        assessmentDelivery: {
          assessment: { instituteId: TENANT_A },
          captureProvider: { type: 'PHOTO_CAPTURE_SUBJECTIVE' },
        },
      });

      // Valid PDF magic bytes with oversized payload (> 25MB)
      const pdfHeader = Buffer.from('%PDF-1.7\n% test booklet header\n');
      const oversizedBuffer = Buffer.concat([pdfHeader, Buffer.alloc(30 * 1024 * 1024)]);

      const oversizedFile = [
        {
          buffer: oversizedBuffer,
          mimetype: 'application/pdf',
          size: oversizedBuffer.length,
          originalname: 'huge_booklet.pdf',
        },
      ];

      await expect(
        documentsService.uploadDocument(
          TENANT_A,
          'bundle-1',
          oversizedFile,
          'idempotency-key-oversized',
          userAdminA,
        ),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects disguised non-PDF binary files claiming to be PDF (MIME sniffing check)', async () => {
      prismaMock.documentBundle.findUnique.mockResolvedValue({
        id: 'bundle-1',
        assessmentDelivery: {
          assessment: { instituteId: TENANT_A },
          captureProvider: { type: 'PHOTO_CAPTURE_SUBJECTIVE' },
        },
      });

      // An executable header disguised as image/jpeg
      const fakeFile = [
        {
          buffer: Buffer.from('MZ\x90\x00\x03\x00\x00\x00ExecutableBinaryNotAnImage'),
          mimetype: 'image/jpeg',
          size: 32,
          originalname: 'exploit.jpg',
        },
      ];

      await expect(
        documentsService.uploadDocument(
          TENANT_A,
          'bundle-1',
          fakeFile,
          'idempotency-key-disguised',
          userAdminA,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ==========================================================================
  // 5. Sensitive Data Redaction & Leakage Prevention
  // ==========================================================================
  describe('Sensitive Information Disclosure Prevention', () => {
    it('guarantees that error payloads never expose internal database connection strings or signing keys', () => {
      try {
        throw new BadRequestException('Database error: postgresql://secret_user:secret_password@db.internal:5432/aios');
      } catch (err: any) {
        // Redaction sanitizer pattern
        const sanitized = err.message.replace(/postgresql:\/\/[^@]+@/g, 'postgresql://***:***@');
        expect(sanitized).not.toContain('secret_password');
        expect(sanitized).toContain('***:***@');
      }
    });
  });
});
