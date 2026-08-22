import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AssignmentsService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: AssignmentsService;
  let prisma: {
    assignment: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    batch: { findUnique: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };
  const student: AuthenticatedUser = { ...admin, id: 'student-1', role: UserRole.STUDENT };

  beforeEach(async () => {
    prisma = {
      assignment: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      batch: { findUnique: jest.fn() },
      studentProfile: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssignmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssignmentsService);
  });

  describe('createAssignment — cross-institute batch/student guard', () => {
    it('rejects a batchId belonging to a different institute', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-OTHER' });
      await expect(
        service.createAssignment('inst-1', { batchId: 'batch-1', topicId: 't-1', title: 'HW', dueDate: '2026-09-01T00:00:00Z' }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.assignment.create).not.toHaveBeenCalled();
    });

    it('rejects a studentProfileId belonging to a different institute', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', user: { instituteId: 'inst-OTHER' } });
      await expect(
        service.createAssignment('inst-1', { studentProfileId: 'sp-1', topicId: 't-1', title: 'HW', dueDate: '2026-09-01T00:00:00Z' }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.assignment.create).not.toHaveBeenCalled();
    });

    it('rejects a student trying to create an assignment', async () => {
      await expect(
        service.createAssignment('inst-1', { batchId: 'batch-1', topicId: 't-1', title: 'HW', dueDate: '2026-09-01T00:00:00Z' }, student),
      ).rejects.toThrow(ForbiddenException);
    });

    it('succeeds when the batch belongs to the same institute', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1' });
      prisma.assignment.create.mockResolvedValueOnce({ id: 'a-1', title: 'HW' });
      await expect(
        service.createAssignment('inst-1', { batchId: 'batch-1', topicId: 't-1', title: 'HW', dueDate: '2026-09-01T00:00:00Z' }, admin),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll — every result must belong to the caller\'s institute', () => {
    it('scopes the query to the institute via batch OR studentProfile relations', async () => {
      prisma.assignment.findMany.mockResolvedValueOnce([]);
      prisma.assignment.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', {}, admin);

      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { OR: [{ batch: { instituteId: 'inst-1' } }, { studentProfile: { user: { instituteId: 'inst-1' } } }] },
            ]),
          }),
        }),
      );
    });
  });

  describe('gradeAssignment — cross-institute write guard (the vulnerability this pass found)', () => {
    it("rejects grading an assignment that belongs to a different institute's batch", async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce({
        id: 'a-1', batch: { instituteId: 'inst-OTHER' }, studentProfile: null,
      });
      await expect(
        service.gradeAssignment('inst-1', 'a-1', { gradedMarks: 8 }, teacher),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.assignment.update).not.toHaveBeenCalled();
    });

    it("rejects grading an assignment that belongs to a different institute's student", async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce({
        id: 'a-1', batch: null, studentProfile: { user: { instituteId: 'inst-OTHER' } },
      });
      await expect(
        service.gradeAssignment('inst-1', 'a-1', { gradedMarks: 8 }, teacher),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.assignment.update).not.toHaveBeenCalled();
    });

    it('404s for a nonexistent assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce(null);
      await expect(service.gradeAssignment('inst-1', 'missing', { gradedMarks: 8 }, teacher)).rejects.toThrow(NotFoundException);
    });

    it('rejects a student trying to grade', async () => {
      await expect(service.gradeAssignment('inst-1', 'a-1', { gradedMarks: 8 }, student)).rejects.toThrow(ForbiddenException);
    });

    it('allows grading when the assignment genuinely belongs to the same institute', async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce({
        id: 'a-1', batch: { instituteId: 'inst-1' }, studentProfile: null,
      });
      prisma.assignment.update.mockResolvedValueOnce({ id: 'a-1', gradedMarks: 8 });
      await expect(service.gradeAssignment('inst-1', 'a-1', { gradedMarks: 8 }, teacher)).resolves.toBeDefined();
    });
  });

  describe('submitAssignment — cross-institute guard', () => {
    it("rejects submitting to an assignment from a different institute's batch", async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce({
        id: 'a-1', batch: { instituteId: 'inst-OTHER' }, studentProfile: null,
      });
      await expect(
        service.submitAssignment('inst-1', 'a-1', { submissionUrl: 'https://x' }, student),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a non-student submitting', async () => {
      await expect(
        service.submitAssignment('inst-1', 'a-1', { submissionUrl: 'https://x' }, admin),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
