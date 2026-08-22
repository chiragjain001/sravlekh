import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, CaptureProviderType, EvidenceType } from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AttemptsService', () => {
  let service: AttemptsService;
  let attemptCreate: jest.Mock;
  let responseCreate: jest.Mock;
  let prisma: {
    assessmentDelivery: { findUnique: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    captureProvider: { findUnique: jest.Mock };
    attempt: { findFirst: jest.Mock; findUnique: jest.Mock };
    question: { findMany: jest.Mock };
    response: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };
  const student: AuthenticatedUser = { id: 'user-student-1', email: 's@x.com', name: 'S', role: UserRole.STUDENT, instituteId: 'inst-1' };

  beforeEach(async () => {
    attemptCreate = jest.fn().mockResolvedValue({ id: 'att-1', isActiveAttempt: true });
    responseCreate = jest.fn().mockResolvedValue({});
    prisma = {
      assessmentDelivery: { findUnique: jest.fn() },
      studentProfile: { findUnique: jest.fn() },
      captureProvider: { findUnique: jest.fn() },
      attempt: { findFirst: jest.fn(), findUnique: jest.fn() },
      question: { findMany: jest.fn().mockResolvedValue([]) },
      response: { findMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: any) => fn({
        attempt: { create: attemptCreate },
        response: { create: responseCreate },
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttemptsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AttemptsService);
  });

  const baseDto = { assessmentDeliveryId: 'd1', studentProfileId: 'sp1', captureProviderId: 'cp1' };

  function mockHappyPath(overrides: { captureProviderType?: CaptureProviderType } = {}) {
    prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
      id: 'd1', batchId: 'b1', assessment: { instituteId: 'inst-1' },
    });
    prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', batchId: 'b1' });
    prisma.captureProvider.findUnique.mockResolvedValueOnce({
      id: 'cp1', instituteId: 'inst-1', type: overrides.captureProviderType ?? CaptureProviderType.MANUAL_GRID,
    });
    prisma.attempt.findFirst.mockResolvedValueOnce(null);
  }

  describe('create', () => {
    it('404s when the delivery does not exist', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce(null);
      await expect(service.create('inst-1', baseDto, teacher)).rejects.toThrow(NotFoundException);
    });

    it('rejects a student not in the delivery batch', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({ id: 'd1', batchId: 'b1', assessment: { instituteId: 'inst-1' } });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', batchId: 'b-OTHER' });
      await expect(service.create('inst-1', baseDto, teacher)).rejects.toThrow(BadRequestException);
    });

    it('rejects PHOTO_CAPTURE_SUBJECTIVE — requires the Phase 10 document pipeline', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({ id: 'd1', batchId: 'b1', assessment: { instituteId: 'inst-1' } });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', batchId: 'b1' });
      prisma.captureProvider.findUnique.mockResolvedValueOnce({ id: 'cp1', instituteId: 'inst-1', type: CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE });
      await expect(service.create('inst-1', baseDto, teacher)).rejects.toThrow(BadRequestException);
    });

    it('creates a first attempt as isActiveAttempt=true', async () => {
      mockHappyPath();
      await service.create('inst-1', baseDto, teacher);
      expect(attemptCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActiveAttempt: true }) }),
      );
    });

    it('inserts a duplicate submission as isActiveAttempt=false rather than toggling the existing row (fix #2)', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({ id: 'd1', batchId: 'b1', assessment: { instituteId: 'inst-1' } });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', batchId: 'b1' });
      prisma.captureProvider.findUnique.mockResolvedValueOnce({ id: 'cp1', instituteId: 'inst-1', type: CaptureProviderType.MANUAL_GRID });
      prisma.attempt.findFirst.mockResolvedValueOnce({ id: 'att-existing', isActiveAttempt: true });

      await service.create('inst-1', baseDto, teacher);

      expect(attemptCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActiveAttempt: false }) }),
      );
    });

    it('stamps evidenceType=OMR_MARK for OMR/PHOTO_CAPTURE_OBJECTIVE, DIGITAL_VALUE otherwise', async () => {
      mockHappyPath({ captureProviderType: CaptureProviderType.OMR });
      prisma.question.findMany.mockResolvedValueOnce([{ id: 'q1', marks: 4 }]);
      await service.create('inst-1', { ...baseDto, responses: [{ questionId: 'q1', marksAwarded: 4, isCorrect: true }] }, teacher);
      expect(responseCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ evidenceType: EvidenceType.OMR_MARK, marksAvailable: 4 }) }),
      );
    });

    it('404s when a response references a question outside the institute', async () => {
      mockHappyPath();
      prisma.question.findMany.mockResolvedValueOnce([]); // question not found for this institute
      await expect(
        service.create('inst-1', { ...baseDto, responses: [{ questionId: 'q-unknown', marksAwarded: 1 }] }, teacher),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findResponses', () => {
    it('lets a student read their own attempt', async () => {
      prisma.attempt.findUnique.mockResolvedValueOnce({
        id: 'att-1', studentProfileId: 'sp1', assessmentDelivery: { assessment: { instituteId: 'inst-1' } },
      });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', userId: 'user-student-1' });
      prisma.response.findMany.mockResolvedValueOnce([]);
      await expect(service.findResponses('inst-1', 'att-1', student)).resolves.toEqual([]);
    });

    it("rejects a student reading someone else's attempt", async () => {
      prisma.attempt.findUnique.mockResolvedValueOnce({
        id: 'att-1', studentProfileId: 'sp-OTHER', assessmentDelivery: { assessment: { instituteId: 'inst-1' } },
      });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp1', userId: 'user-student-1' });
      await expect(service.findResponses('inst-1', 'att-1', student)).rejects.toThrow(ForbiddenException);
    });
  });
});
