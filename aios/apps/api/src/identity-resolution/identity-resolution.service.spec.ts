import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserRole, IdentityStatus, BookletStatus } from '@prisma/client';
import { IdentityResolutionService } from './identity-resolution.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { BookletSecurityService } from '../booklets/booklet-security.service';

describe('IdentityResolutionService', () => {
  let service: IdentityResolutionService;
  let attemptCreate: jest.Mock;
  let documentUpdate: jest.Mock;
  let identityResolutionUpdate: jest.Mock;
  let prisma: {
    identityResolution: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; upsert: jest.Mock };
    studentProfile: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    batchEnrollment: { findFirst: jest.Mock; findMany: jest.Mock };
    booklet: { findFirst: jest.Mock; update: jest.Mock };
    attempt: { findFirst: jest.Mock };
    document: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    pageRegion: { findMany: jest.Mock };
    question: { findUnique: jest.Mock };
    response: { upsert: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };

  beforeEach(async () => {
    attemptCreate = jest.fn().mockResolvedValue({ id: 'att-new' });
    documentUpdate = jest.fn().mockResolvedValue({});
    identityResolutionUpdate = jest.fn().mockResolvedValue({ id: 'res-1', status: IdentityStatus.MANUALLY_CONFIRMED });

    prisma = {
      identityResolution: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({ id: 'res-1' }),
      },
      studentProfile: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      batchEnrollment: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      booklet: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      attempt: { findFirst: jest.fn() },
      document: { findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue({ id: 'doc-1', attemptId: null }), update: documentUpdate },
      pageRegion: { findMany: jest.fn().mockResolvedValue([]) },
      question: { findUnique: jest.fn() },
      response: { upsert: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn: any) => fn({
        attempt: { create: attemptCreate },
        document: { update: documentUpdate },
        identityResolution: { update: identityResolutionUpdate, upsert: jest.fn().mockResolvedValue({ id: 'res-1' }) },
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityResolutionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BookletSecurityService,
          useValue: {
            verifyBookletQr: jest.fn(),
            signBooklet: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get(IdentityResolutionService);
  });

  function mockResolution(overrides: { status?: IdentityStatus } = {}) {
    prisma.identityResolution.findUnique.mockResolvedValueOnce({
      id: 'res-1',
      documentId: 'doc-1',
      status: overrides.status ?? IdentityStatus.PENDING,
      method: 'MANUAL_ADMIN_MATCH',
      confidence: 0,
      document: {
        documentBundle: {
          assessmentDelivery: { id: 'delivery-1', batchId: 'batch-1', assessment: { instituteId: 'inst-1' } },
        },
      },
    });
  }

  describe('findAll', () => {
    it('defaults to status=PENDING', async () => {
      prisma.identityResolution.findMany.mockResolvedValueOnce([]);
      await service.findAll('inst-1', {}, teacher);
      expect(prisma.identityResolution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: IdentityStatus.PENDING }) }),
      );
    });
  });

  describe('confirm', () => {
    it('404s when the resolution does not exist', async () => {
      prisma.identityResolution.findUnique.mockResolvedValueOnce(null);
      await expect(service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher)).rejects.toThrow(NotFoundException);
    });

    // 13-TESTING-STRATEGY.md v2 addendum: identity-resolution conflict/tenant
    // fuzzing — a resolution belonging to another institute's document must
    // never be readable or actionable via a correct-looking instituteId param.
    it('404s (never leaks existence) when the resolution belongs to a different institute', async () => {
      prisma.identityResolution.findUnique.mockResolvedValueOnce({
        id: 'res-1',
        documentId: 'doc-1',
        status: IdentityStatus.PENDING,
        document: {
          documentBundle: {
            assessmentDelivery: { id: 'delivery-1', batchId: 'batch-1', assessment: { instituteId: 'inst-OTHER' } },
          },
        },
      });
      await expect(service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher)).rejects.toThrow(NotFoundException);
    });

    it('rejects a fuzzed/nonexistent studentProfileId', async () => {
      mockResolution();
      prisma.studentProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-does-not-exist' }, teacher)).rejects.toThrow(BadRequestException);
    });

    it('rejects re-confirming an already-resolved document', async () => {
      mockResolution({ status: IdentityStatus.MANUALLY_CONFIRMED });
      await expect(service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher)).rejects.toThrow(ConflictException);
    });

    it('rejects a student not in the delivery batch', async () => {
      mockResolution();
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', batchId: 'batch-OTHER' });
      await expect(service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher)).rejects.toThrow(BadRequestException);
    });

    it('flags CONFLICT when another document already claimed this student+delivery (30 §5)', async () => {
      mockResolution();
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', batchId: 'batch-1' });
      prisma.attempt.findFirst.mockResolvedValueOnce({ id: 'att-existing' });
      prisma.document.findFirst.mockResolvedValueOnce({ id: 'doc-OTHER' }); // a different document already linked to att-existing

      await expect(service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher)).rejects.toThrow(ConflictException);
      expect(prisma.identityResolution.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: IdentityStatus.CONFLICT }) }),
      );
      expect(attemptCreate).not.toHaveBeenCalled();
    });

    it('creates a new Attempt and links the document when no conflict exists', async () => {
      mockResolution();
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', batchId: 'batch-1' });
      prisma.attempt.findFirst.mockResolvedValueOnce(null);

      await service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher);

      expect(attemptCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assessmentDeliveryId: 'delivery-1', studentProfileId: 'sp-1', isActiveAttempt: true }) }),
      );
      expect(documentUpdate).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { attemptId: 'att-new' } });
      expect(identityResolutionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: IdentityStatus.MANUALLY_CONFIRMED, resolvedStudentProfileId: 'sp-1' }) }),
      );
    });

    it('reuses an existing active Attempt with no conflicting document', async () => {
      mockResolution();
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', batchId: 'batch-1' });
      prisma.attempt.findFirst.mockResolvedValueOnce({ id: 'att-existing' });
      prisma.document.findFirst.mockResolvedValueOnce(null); // no other document claims it

      await service.confirm('inst-1', 'res-1', { studentProfileId: 'sp-1' }, teacher);

      expect(attemptCreate).not.toHaveBeenCalled();
      expect(documentUpdate).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { attemptId: 'att-existing' } });
    });
  });

  describe('resolveFromQrAndOmr', () => {
    const baseDoc = {
      id: 'doc-1',
      documentBundle: {
        assessmentDelivery: {
          id: 'del-1',
          batchId: 'batch-1',
          assessment: { instituteId: 'inst-1' },
        },
      },
    };

    it('auto-resolves attempt when student is enrolled in batch and confidence >= 0.95', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      prisma.booklet.findFirst.mockResolvedValueOnce({ id: 'bkl-1', status: 'PRINTED' });
      prisma.batchEnrollment.findMany.mockResolvedValueOnce([{ studentProfileId: 'stu-1', rollNumber: '101' }]);
      prisma.attempt.findFirst.mockResolvedValueOnce(null);

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-101',
        detectedRollNumber: '101',
        confidence: 0.98,
      });

      expect(res.status).toBe(IdentityStatus.AUTO_RESOLVED);
      expect(res.studentId).toBe('stu-1');
      expect(attemptCreate).toHaveBeenCalled();
    });

    it('flags CONFLICT when multiple candidates match normalized roll number (normalization collision protection)', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      prisma.booklet.findFirst.mockResolvedValueOnce({ id: 'bkl-1', status: 'PRINTED' });
      // Both student '42' and student '042' exist in the batch!
      prisma.batchEnrollment.findMany.mockResolvedValueOnce([
        { studentProfileId: 'stu-1', rollNumber: '42' },
        { studentProfileId: 'stu-2', rollNumber: '042' },
      ]);

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-101',
        detectedRollNumber: '042',
        confidence: 0.98,
      });

      expect(res.status).toBe(IdentityStatus.CONFLICT);
      expect(res.reason).toContain('Ambiguous match: multiple students match roll candidates');
      expect(attemptCreate).not.toHaveBeenCalled();
    });

    it('flags UNRESOLVED when detected roll number is not in delivery batch', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      prisma.booklet.findFirst.mockResolvedValueOnce(null);
      prisma.batchEnrollment.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        detectedRollNumber: '999',
        confidence: 0.99,
      });

      expect(res.status).toBe(IdentityStatus.UNRESOLVED);
      expect(res.reason).toContain('not enrolled');
    });

    it('flags CONFLICT when booklet was voided', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      prisma.booklet.findFirst.mockResolvedValueOnce({ id: 'bkl-1', status: BookletStatus.VOIDED, voidReason: 'Damaged' });

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-VOID',
        confidence: 0.99,
      });

      expect(res.status).toBe(IdentityStatus.CONFLICT);
      expect(res.reason).toContain('voided');
    });

    it('flags CONFLICT when another document is already linked to the student for this delivery', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      prisma.booklet.findFirst.mockResolvedValueOnce({ id: 'bkl-1', status: 'PRINTED' });
      prisma.batchEnrollment.findMany.mockResolvedValueOnce([{ studentProfileId: 'stu-1', rollNumber: '101' }]);
      prisma.attempt.findFirst.mockResolvedValueOnce({ id: 'att-1' });
      prisma.document.findFirst.mockResolvedValueOnce({ id: 'doc-other', attemptId: 'att-1' });

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-101',
        detectedRollNumber: '101',
        confidence: 0.98,
      });

      expect(res.status).toBe(IdentityStatus.CONFLICT);
      expect(res.reason).toContain('Another document is already linked');
    });

    it('sets PENDING status when confidence is below 0.95', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      prisma.booklet.findFirst.mockResolvedValueOnce({ id: 'bkl-1', status: 'PRINTED' });
      prisma.batchEnrollment.findMany.mockResolvedValueOnce([{ studentProfileId: 'stu-1', rollNumber: '101' }]);
      prisma.attempt.findFirst.mockResolvedValueOnce(null);

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-101',
        detectedRollNumber: '101',
        confidence: 0.85,
      });

      expect(res.status).toBe(IdentityStatus.PENDING);
      expect(res.confidence).toBe(0.85);
      expect(res.candidateStudentProfileId).toBe('stu-1');
    });

    it('flags CONFLICT when QR cryptographic signature verification fails', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      const bookletSec = (service as any).bookletSecurity;
      bookletSec.verifyBookletQr.mockImplementationOnce(() => {
        throw new UnauthorizedException('Cryptographic signature verification failed');
      });

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-FORGED',
        confidence: 0.99,
        qrPayload: 'AIOS:V1:k1:inst-1:del-1:1:BKL-FORGED:bad_sig',
      });

      expect(res.status).toBe(IdentityStatus.CONFLICT);
      expect(res.reason).toContain('signature verification failed');
    });

    it('flags CONFLICT when booklet QR belongs to another institute tenant', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      const bookletSec = (service as any).bookletSecurity;
      bookletSec.verifyBookletQr.mockReturnValueOnce({
        isValid: true,
        payload: { inst: 'inst-OTHER', del: 'del-1', bkl: 'BKL-101' },
      });

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-101',
        confidence: 0.99,
        qrPayload: 'AIOS:V1:k1:inst-OTHER:del-1:1:BKL-101:valid_sig',
      });

      expect(res.status).toBe(IdentityStatus.CONFLICT);
      expect(res.reason).toContain('another institute tenant');
    });

    it('flags CONFLICT when booklet serial belongs to another assessment delivery', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(baseDoc);
      // Booklet not found in current delivery del-1
      prisma.booklet.findFirst.mockResolvedValueOnce(null);
      // But found in foreign delivery del-FOREIGN
      prisma.booklet.findFirst.mockResolvedValueOnce({ assessmentDeliveryId: 'del-FOREIGN' });

      const res = await service.resolveFromQrAndOmr({
        instituteId: 'inst-1',
        documentId: 'doc-1',
        assessmentDeliveryId: 'del-1',
        bookletSerial: 'BKL-CROSS-DELIVERY',
        confidence: 0.99,
      });

      expect(res.status).toBe(IdentityStatus.CONFLICT);
      expect(res.reason).toContain('belongs to another assessment delivery');
    });
  });
});
