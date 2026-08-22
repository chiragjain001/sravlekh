import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole, IdentityStatus } from '@prisma/client';
import { IdentityResolutionService } from './identity-resolution.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('IdentityResolutionService', () => {
  let service: IdentityResolutionService;
  let attemptCreate: jest.Mock;
  let documentUpdate: jest.Mock;
  let identityResolutionUpdate: jest.Mock;
  let prisma: {
    identityResolution: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    attempt: { findFirst: jest.Mock };
    document: { findFirst: jest.Mock; findUnique: jest.Mock };
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
      identityResolution: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      studentProfile: { findUnique: jest.fn() },
      attempt: { findFirst: jest.fn() },
      document: { findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue({ id: 'doc-1', attemptId: null }) },
      pageRegion: { findMany: jest.fn().mockResolvedValue([]) },
      question: { findUnique: jest.fn() },
      response: { upsert: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn: any) => fn({
        attempt: { create: attemptCreate },
        document: { update: documentUpdate },
        identityResolution: { update: identityResolutionUpdate },
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [IdentityResolutionService, { provide: PrismaService, useValue: prisma }],
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
});
