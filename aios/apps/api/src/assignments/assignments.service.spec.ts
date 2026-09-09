import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AssignmentsService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: AssignmentsService;
  let prisma: {
    assignment: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    batch: { findUnique: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
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
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const storage = { buildKey: jest.fn(), upload: jest.fn(), getSignedDownloadUrl: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
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

    it('restricts a TEACHER to assignments for their own batches (batch-wide or per-student)', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.assignment.findMany.mockResolvedValueOnce([]);
      prisma.assignment.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', {}, teacher);

      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { OR: [{ batchId: { in: ['batch-1'] } }, { studentProfile: { batchId: { in: ['batch-1'] } } }] },
            ]),
          }),
        }),
      );
    });
  });

  // ── Student privacy: a student must never reach a classmate's row ─────────
  //
  // Regression guard for the leak where `OR: [{studentProfileId: me}, {batchId: myBatch}]`
  // returned every classmate's per-student row — names, submission status and marks —
  // to anyone enrolled in the batch.
  describe('findAll — a STUDENT sees only their own assignments', () => {
    it('never filters by bare batchId (which would match classmates\' rows)', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-me', batchId: 'batch-1' });
      prisma.assignment.findMany.mockResolvedValueOnce([]);
      prisma.assignment.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', {}, student);

      const where = prisma.assignment.findMany.mock.calls[0][0].where;
      const clauses = JSON.stringify(where.AND);

      // The only batch clause allowed is one pinned to studentProfileId: null.
      expect(clauses).not.toContain('{"batchId":"batch-1"}');
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { OR: [{ studentProfileId: 'sp-me' }, { batchId: 'batch-1', studentProfileId: null }] },
        ]),
      );
    });

    it('falls back to own-rows-only when the student has no batch', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-me', batchId: null });
      prisma.assignment.findMany.mockResolvedValueOnce([]);
      prisma.assignment.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', {}, student);

      expect(prisma.assignment.findMany.mock.calls[0][0].where.AND).toEqual(
        expect.arrayContaining([{ studentProfileId: 'sp-me' }]),
      );
    });

    it('rejects a student with no profile rather than falling back to a broad query', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findAll('inst-1', {}, student)).rejects.toThrow(ForbiddenException);
      expect(prisma.assignment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getSubmissionDownloadUrl — a student cannot open a classmate\'s file', () => {
    const classmateRow = {
      id: 'a-classmate',
      submissionUrl: 'inst-1/assignments/a-classmate/answer.pdf',
      studentProfileId: 'sp-classmate',
      batchId: 'batch-1',
      batch: { instituteId: 'inst-1' },
      studentProfile: { user: { instituteId: 'inst-1' } },
    };

    it('denies a classmate in the same batch', async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce(classmateRow);
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-me', batchId: 'batch-1' });

      await expect(service.getSubmissionDownloadUrl('inst-1', 'a-classmate', student)).rejects.toThrow(ForbiddenException);
    });

    it('allows the owning student', async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce({ ...classmateRow, studentProfileId: 'sp-me' });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-me', batchId: 'batch-1' });

      await expect(service.getSubmissionDownloadUrl('inst-1', 'a-classmate', student)).resolves.toEqual({ url: undefined });
    });
  });

  describe('submitAssignment — a student cannot submit against a classmate\'s row', () => {
    it('denies submitting to a row owned by another student in the same batch', async () => {
      prisma.assignment.findUnique.mockResolvedValueOnce({
        id: 'a-classmate',
        studentProfileId: 'sp-classmate',
        batchId: 'batch-1',
        batch: { instituteId: 'inst-1' },
        studentProfile: { user: { instituteId: 'inst-1' } },
      });
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-me', batchId: 'batch-1' });

      await expect(
        service.submitAssignment('inst-1', 'a-classmate', { submissionUrl: 'x' }, student),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.assignment.update).not.toHaveBeenCalled();
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
