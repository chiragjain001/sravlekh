import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole, AssignmentScope } from '@prisma/client';
import { CopyCheckerAssignmentsService } from './copy-checker-assignments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('CopyCheckerAssignmentsService', () => {
  let service: CopyCheckerAssignmentsService;
  let prisma: any;

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@inst.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    instituteId: 'inst-1',
  };

  const teacherUser: AuthenticatedUser = {
    id: 'user-teacher-1',
    email: 'teacher@inst.com',
    name: 'Mr. Sharma',
    role: UserRole.TEACHER,
    instituteId: 'inst-1',
  };

  beforeEach(async () => {
    prisma = {
      assessmentDelivery: {
        findUnique: jest.fn(),
      },
      teacherProfile: {
        findUnique: jest.fn(),
      },
      batchTeacher: {
        findFirst: jest.fn(),
      },
      copyCheckerAssignment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      copyCheckerStudentAllocation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      copyCheckerQuestionAllocation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopyCheckerAssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CopyCheckerAssignmentsService);
  });

  describe('assign', () => {
    it('rejects if assessment delivery does not exist or belongs to another institute', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.assign('inst-1', 'del-1', { teacherProfileId: 'tp-1' }, admin),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects STUDENT_LIST scope if studentProfileIds is empty', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'del-1',
        assessment: { instituteId: 'inst-1' },
      });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({
        id: 'tp-1',
        user: { instituteId: 'inst-1' },
      });

      await expect(
        service.assign(
          'inst-1',
          'del-1',
          { teacherProfileId: 'tp-1', scope: AssignmentScope.STUDENT_LIST, studentProfileIds: [] },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates assignment and student allocations for STUDENT_LIST scope', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'del-1',
        assessment: { instituteId: 'inst-1' },
      });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({
        id: 'tp-1',
        user: { instituteId: 'inst-1' },
      });
      prisma.copyCheckerAssignment.upsert.mockResolvedValueOnce({
        id: 'cca-1',
        assessmentDeliveryId: 'del-1',
        teacherProfileId: 'tp-1',
        scope: AssignmentScope.STUDENT_LIST,
      });

      const res = await service.assign(
        'inst-1',
        'del-1',
        {
          teacherProfileId: 'tp-1',
          scope: AssignmentScope.STUDENT_LIST,
          studentProfileIds: ['sp-1', 'sp-2'],
        },
        admin,
      );

      expect(res.id).toBe('cca-1');
      expect(prisma.copyCheckerStudentAllocation.deleteMany).toHaveBeenCalled();
      expect(prisma.copyCheckerStudentAllocation.create).toHaveBeenCalledTimes(2);
    });

    it('rejects if a student is already allocated to another evaluator for this delivery', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'del-1',
        assessment: { instituteId: 'inst-1' },
      });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({
        id: 'tp-1',
        user: { instituteId: 'inst-1' },
      });
      prisma.copyCheckerAssignment.upsert.mockResolvedValueOnce({
        id: 'cca-1',
        assessmentDeliveryId: 'del-1',
        teacherProfileId: 'tp-1',
        scope: AssignmentScope.STUDENT_LIST,
      });
      // Simulate existing conflict on another evaluator
      prisma.copyCheckerStudentAllocation.findFirst.mockResolvedValueOnce({
        id: 'alloc-existing',
        copyCheckerAssignmentId: 'cca-OTHER',
        studentProfileId: 'sp-1',
        studentProfile: { studentCode: 'STU-001', rollNumber: '101' },
      });

      await expect(
        service.assign(
          'inst-1',
          'del-1',
          {
            teacherProfileId: 'tp-1',
            scope: AssignmentScope.STUDENT_LIST,
            studentProfileIds: ['sp-1'],
          },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if a question is already allocated to another evaluator for this delivery', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'del-1',
        assessment: { instituteId: 'inst-1' },
      });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({
        id: 'tp-1',
        user: { instituteId: 'inst-1' },
      });
      prisma.copyCheckerAssignment.upsert.mockResolvedValueOnce({
        id: 'cca-1',
        assessmentDeliveryId: 'del-1',
        teacherProfileId: 'tp-1',
        scope: AssignmentScope.QUESTION_WISE,
      });
      // Simulate existing conflict on another evaluator
      prisma.copyCheckerQuestionAllocation.findFirst.mockResolvedValueOnce({
        id: 'alloc-q-existing',
        copyCheckerAssignmentId: 'cca-OTHER',
        questionId: 'q-1',
      });

      await expect(
        service.assign(
          'inst-1',
          'del-1',
          {
            teacherProfileId: 'tp-1',
            scope: AssignmentScope.QUESTION_WISE,
            questionIds: ['q-1'],
          },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assertTeacherAuthorized', () => {
    it('allows Admin unconditionally within their institute', async () => {
      const res = await service.assertTeacherAuthorized({
        assessmentDeliveryId: 'del-1',
        studentProfileId: 'sp-1',
        actor: admin,
      });

      expect(res.authorized).toBe(true);
      expect(res.isLead).toBe(true);
    });

    it('rejects if teacher has no profile in the institute', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertTeacherAuthorized({
          assessmentDeliveryId: 'del-1',
          studentProfileId: 'sp-1',
          actor: teacherUser,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows teacher assigned with BATCH scope', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.copyCheckerAssignment.findUnique.mockResolvedValueOnce({
        id: 'cca-1',
        scope: AssignmentScope.BATCH,
        isLeadEvaluator: false,
      });

      const res = await service.assertTeacherAuthorized({
        assessmentDeliveryId: 'del-1',
        studentProfileId: 'sp-1',
        actor: teacherUser,
      });

      expect(res.authorized).toBe(true);
      expect(res.scope).toBe(AssignmentScope.BATCH);
    });

    it('authorizes teacher assigned with STUDENT_LIST scope if student is allocated to this assignment', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.copyCheckerAssignment.findUnique.mockResolvedValueOnce({
        id: 'cca-1',
        scope: AssignmentScope.STUDENT_LIST,
        isLeadEvaluator: false,
      });
      prisma.copyCheckerStudentAllocation.findUnique.mockResolvedValueOnce({
        id: 'alloc-1',
        copyCheckerAssignmentId: 'cca-1',
        assessmentDeliveryId: 'del-1',
        studentProfileId: 'sp-1',
      });

      const res = await service.assertTeacherAuthorized({
        assessmentDeliveryId: 'del-1',
        studentProfileId: 'sp-1',
        actor: teacherUser,
      });

      expect(res.authorized).toBe(true);
      expect(res.scope).toBe(AssignmentScope.STUDENT_LIST);
    });

    it('rejects teacher assigned with STUDENT_LIST scope if student is not allocated', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.copyCheckerAssignment.findUnique.mockResolvedValueOnce({
        id: 'cca-1',
        scope: AssignmentScope.STUDENT_LIST,
        isLeadEvaluator: false,
      });
      prisma.copyCheckerStudentAllocation.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertTeacherAuthorized({
          assessmentDeliveryId: 'del-1',
          studentProfileId: 'sp-unallocated',
          actor: teacherUser,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects teacher assigned with STUDENT_LIST scope if student is allocated to a different teacher', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.copyCheckerAssignment.findUnique.mockResolvedValueOnce({
        id: 'cca-1',
        scope: AssignmentScope.STUDENT_LIST,
        isLeadEvaluator: false,
      });
      prisma.copyCheckerStudentAllocation.findUnique.mockResolvedValueOnce({
        id: 'alloc-other',
        copyCheckerAssignmentId: 'cca-OTHER',
        assessmentDeliveryId: 'del-1',
        studentProfileId: 'sp-1',
      });

      await expect(
        service.assertTeacherAuthorized({
          assessmentDeliveryId: 'del-1',
          studentProfileId: 'sp-1',
          actor: teacherUser,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks whole-sheet finalization if teacher assignment is QUESTION_WISE', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.copyCheckerAssignment.findUnique.mockResolvedValueOnce({
        id: 'cca-1',
        scope: AssignmentScope.QUESTION_WISE,
        isLeadEvaluator: false,
      });

      await expect(
        service.assertTeacherAuthorized({
          assessmentDeliveryId: 'del-1',
          studentProfileId: 'sp-1',
          actor: teacherUser,
          requireWholeSheetAccess: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows fallback to BatchTeacher if no explicit delivery assignment exists', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.copyCheckerAssignment.findUnique.mockResolvedValueOnce(null);
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({ batchId: 'batch-1' });
      prisma.batchTeacher.findFirst.mockResolvedValueOnce({ id: 'bt-1' });

      const res = await service.assertTeacherAuthorized({
        assessmentDeliveryId: 'del-1',
        studentProfileId: 'sp-1',
        actor: teacherUser,
      });

      expect(res.authorized).toBe(true);
      expect(res.scope).toBe(AssignmentScope.BATCH);
    });
  });
});
