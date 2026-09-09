import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BatchesService } from './batches.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('BatchesService — curriculum (subjects/chapters/topics)', () => {
  let service: BatchesService;
  let prisma: {
    subject: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    chapter: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    topic: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    batch: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
    studentProfile: { findMany: jest.Mock };
    scoreRecord: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'a@x.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    instituteId: 'inst-1',
  };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      subject: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      chapter: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      topic: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      batch: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn() },
      studentProfile: { findMany: jest.fn() },
      scoreRecord: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
      ],
    }).compile();
    service = module.get(BatchesService);
  });

  describe('updateSubject', () => {
    it('rejects a subject belonging to a different institute (tenant isolation)', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({ id: 'sub-1', instituteId: 'other-inst', deletedAt: null });

      await expect(service.updateSubject('inst-1', 'sub-1', { name: 'Chemistry' }, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects renaming to a name already used by another subject', async () => {
      prisma.subject.findUnique
        .mockResolvedValueOnce({ id: 'sub-1', instituteId: 'inst-1', name: 'Physics', deletedAt: null })
        .mockResolvedValueOnce({ id: 'sub-2', instituteId: 'inst-1', name: 'Chemistry' });

      await expect(service.updateSubject('inst-1', 'sub-1', { name: 'Chemistry' }, admin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a non-admin, non-founder actor outright', async () => {
      const teacher = { ...admin, role: UserRole.TEACHER };
      await expect(service.updateSubject('inst-1', 'sub-1', { name: 'Chemistry' }, teacher)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.subject.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('archiveSubject', () => {
    it('soft-deletes (sets deletedAt) rather than removing the row', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({ id: 'sub-1', instituteId: 'inst-1', deletedAt: null });
      prisma.subject.update.mockResolvedValueOnce({ id: 'sub-1', deletedAt: new Date() });

      await service.archiveSubject('inst-1', 'sub-1', admin);

      expect(prisma.subject.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('writes an audit log entry for the archive action', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({ id: 'sub-1', instituteId: 'inst-1', deletedAt: null });
      prisma.subject.update.mockResolvedValueOnce({});

      await service.archiveSubject('inst-1', 'sub-1', admin);

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('treats an already-archived subject as not found (cannot archive twice)', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({
        id: 'sub-1',
        instituteId: 'inst-1',
        deletedAt: new Date(),
      });

      await expect(service.archiveSubject('inst-1', 'sub-1', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllSubjects', () => {
    it('excludes archived subjects and archived chapters/topics from the nested tree', async () => {
      prisma.subject.findMany.mockResolvedValueOnce([]);

      await service.findAllSubjects('inst-1', admin);

      const call = prisma.subject.findMany.mock.calls[0]![0];
      expect(call.where).toEqual({ instituteId: 'inst-1', deletedAt: null });
      expect(call.include.chapters.where).toEqual({ deletedAt: null });
      expect(call.include.chapters.include.topics.where).toEqual({ deletedAt: null });
    });
  });

  describe('academics-tree caching (09-CACHING-STRATEGY.md §1.1)', () => {
    it('serves a cache hit without touching the DB', async () => {
      const cache = (service as any).cache;
      cache.get.mockResolvedValueOnce([{ id: 'cached-subject' }]);

      const result = await service.findAllSubjects('inst-1', admin);

      expect(result).toEqual([{ id: 'cached-subject' }]);
      expect(prisma.subject.findMany).not.toHaveBeenCalled();
    });

    it('populates the cache on a miss, keyed by institute', async () => {
      const cache = (service as any).cache;
      cache.get.mockResolvedValueOnce(undefined);
      prisma.subject.findMany.mockResolvedValueOnce([{ id: 'fresh-subject' }]);

      await service.findAllSubjects('inst-1', admin);

      expect(cache.set).toHaveBeenCalledWith('academics-tree:inst-1', [{ id: 'fresh-subject' }], 30 * 60);
    });

    it('invalidates the tree cache when a subject is created', async () => {
      const cache = (service as any).cache;
      prisma.subject.findUnique.mockResolvedValueOnce(null);
      prisma.subject.create.mockResolvedValueOnce({ id: 'sub-1' });

      await service.createSubject('inst-1', { name: 'Physics' }, admin);

      expect(cache.del).toHaveBeenCalledWith('academics-tree:inst-1');
    });
  });

  describe('teacher batch scoping', () => {
    it('findAllBatches restricts a TEACHER to their assigned batches only', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }, { batchId: 'batch-2' }]);
      prisma.batch.findMany.mockResolvedValueOnce([]);

      await service.findAllBatches('inst-1', teacher);

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { instituteId: 'inst-1', id: { in: ['batch-1', 'batch-2'] } } }),
      );
    });

    it('findAllBatches keeps institute-wide visibility for ADMIN (no id filter)', async () => {
      prisma.batch.findMany.mockResolvedValueOnce([]);

      await service.findAllBatches('inst-1', admin);

      const call = prisma.batch.findMany.mock.calls[0]![0];
      expect(call.where).toEqual({ instituteId: 'inst-1' });
      expect(prisma.teacherProfile.findUnique).not.toHaveBeenCalled();
    });

    it('findAllBatches returns no id restriction bypass for a teacher with no profile yet (empty list, not a crash)', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce(null);
      prisma.batch.findMany.mockResolvedValueOnce([]);

      await service.findAllBatches('inst-1', teacher);

      expect(prisma.batch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { instituteId: 'inst-1', id: { in: [] } } }),
      );
    });

    it('findBatchById rejects a teacher viewing a batch they are not assigned to', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      await expect(service.findBatchById('inst-1', 'batch-OTHER', teacher)).rejects.toThrow(ForbiddenException);
      expect(prisma.batch.findUnique).not.toHaveBeenCalled();
    });

    it('findBatchById allows a teacher viewing their own assigned batch', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1' });

      await expect(service.findBatchById('inst-1', 'batch-1', teacher)).resolves.toBeDefined();
    });
  });

  describe('getBatchPerformance', () => {
    it('rejects a teacher outside the batch', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-OTHER' }]);

      await expect(service.getBatchPerformance('inst-1', 'batch-1', teacher)).rejects.toThrow(ForbiddenException);
      expect(prisma.batch.findUnique).not.toHaveBeenCalled();
    });

    it('ranks students by average score and buckets weak/average/excellent', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1', name: 'Alpha', classYear: 'Class 11', section: 'A' });
      prisma.studentProfile.findMany.mockResolvedValueOnce([
        { id: 's1', rollNumber: '01', user: { name: 'Aarav' } },
        { id: 's2', rollNumber: '02', user: { name: 'Diya' } },
        { id: 's3', rollNumber: '03', user: { name: 'Kabir' } },
      ]);
      prisma.scoreRecord.findMany.mockResolvedValueOnce([
        { studentProfileId: 's1', percentage: 80, obtainedMarks: 40, totalMarks: 50, examId: 'e2', createdAt: new Date('2026-02-01'), exam: { scheduledDate: new Date('2026-02-01'), createdAt: new Date('2026-02-01') } },
        { studentProfileId: 's2', percentage: 40, obtainedMarks: 20, totalMarks: 50, examId: 'e2', createdAt: new Date('2026-02-01'), exam: { scheduledDate: new Date('2026-02-01'), createdAt: new Date('2026-02-01') } },
        // s3 has no scored records -> 'unscored'
      ]);

      const result = await service.getBatchPerformance('inst-1', 'batch-1', admin);

      expect(result.students.find((s: any) => s.id === 's1')).toEqual(expect.objectContaining({ avgScore: 80, status: 'excellent', rank: 1 }));
      expect(result.students.find((s: any) => s.id === 's2')).toEqual(expect.objectContaining({ avgScore: 40, status: 'weak' }));
      expect(result.students.find((s: any) => s.id === 's3')).toEqual(expect.objectContaining({ avgScore: 0, status: 'unscored' }));
      expect(result.batch.studentCount).toBe(3);
      // batch avg only counts scored students: (80 + 40) / 2 = 60
      expect(result.batch.avgScore).toBe(60);
    });
  });

  describe('archiveBatch', () => {
    it('rejects a TEACHER (non-admin) archiving a batch', async () => {
      await expect(service.archiveBatch('inst-1', 'batch-1', teacher)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a batch from a different institute', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-OTHER', isActive: true });
      await expect(service.archiveBatch('inst-1', 'batch-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('rejects double-archiving an already-inactive batch', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1', isActive: false });
      await expect(service.archiveBatch('inst-1', 'batch-1', admin)).rejects.toThrow(ConflictException);
    });

    it('sets isActive false and writes an audit entry', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1', isActive: true });

      const result = await service.archiveBatch('inst-1', 'batch-1', admin);

      expect(prisma.batch.update).toHaveBeenCalledWith({ where: { id: 'batch-1' }, data: { isActive: false } });
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(result.message).toContain('archived');
    });
  });

  describe('getStats', () => {
    it('scopes a TEACHER caller to their own batches only', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.batch.count.mockResolvedValue(0);
      prisma.batch.findMany.mockResolvedValueOnce([]);

      await service.getStats('inst-1', teacher);

      const countCall = prisma.batch.count.mock.calls[0]![0];
      expect(countCall.where.id).toEqual({ in: ['batch-1'] });
    });

    it('aggregates real counts by class year and enrollment, not invented values', async () => {
      prisma.batch.count.mockResolvedValueOnce(3); // total
      prisma.batch.count.mockResolvedValueOnce(2); // active
      prisma.batch.findMany.mockResolvedValueOnce([
        { id: 'b1', name: 'Alpha', classYear: 'Class 11', _count: { students: 30 } },
        { id: 'b2', name: 'Beta', classYear: 'Class 11', _count: { students: 10 } },
        { id: 'b3', name: 'Gamma', classYear: 'Class 12', _count: { students: 20 } },
      ]);

      const stats = await service.getStats('inst-1', admin);

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.inactive).toBe(1);
      expect(stats.byClassYear).toEqual(
        expect.arrayContaining([{ classYear: 'Class 11', count: 2 }, { classYear: 'Class 12', count: 1 }]),
      );
      expect(stats.byEnrollment[0]).toEqual({ batchId: 'b1', batchName: 'Alpha', studentCount: 30 });
    });
  });

  describe('archiveChapter / archiveTopic', () => {
    it('archiveChapter rejects a chapter whose subject belongs to a different institute', async () => {
      prisma.chapter.findUnique.mockResolvedValueOnce({
        id: 'ch-1',
        deletedAt: null,
        subject: { instituteId: 'other-inst' },
      });

      await expect(service.archiveChapter('inst-1', 'ch-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('archiveTopic rejects a topic whose chapter/subject belongs to a different institute', async () => {
      prisma.topic.findUnique.mockResolvedValueOnce({
        id: 'top-1',
        deletedAt: null,
        chapter: { subject: { instituteId: 'other-inst' } },
      });

      await expect(service.archiveTopic('inst-1', 'top-1', admin)).rejects.toThrow(NotFoundException);
    });
  });
  // Guards the N+1: the per-class dashboards used to call getBatchPerformance()
  // once per batch — one request and two queries each, so nine sections cost
  // eighteen queries to render a few numbers per card.
  describe('getBatchPerformanceSummaries — constant query count', () => {
    const nineBatches = Array.from({ length: 9 }, (_, i) => ({
      id: `b-${i}`, name: `Class ${i}`, classYear: 'Class 10', section: 'A',
    }));

    it('reads every batch with a fixed number of queries, not one set per batch', async () => {
      prisma.batch.findMany.mockResolvedValueOnce(nineBatches);
      prisma.studentProfile.findMany.mockResolvedValueOnce(
        nineBatches.flatMap((b, i) => [{ id: `s-${i}-1`, batchId: b.id }, { id: `s-${i}-2`, batchId: b.id }]),
      );
      prisma.scoreRecord.findMany.mockResolvedValueOnce([]);

      const result = await service.getBatchPerformanceSummaries('inst-1', admin);

      expect(result).toHaveLength(9);
      expect(prisma.batch.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.studentProfile.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.scoreRecord.findMany).toHaveBeenCalledTimes(1);
      expect(result.every((b) => b.studentCount === 2)).toBe(true);
    });

    it('derives avgScore and trend per batch from a single score-record read', async () => {
      prisma.batch.findMany.mockResolvedValueOnce([nineBatches[0]]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([
        { id: 's-1', batchId: 'b-0' }, { id: 's-2', batchId: 'b-0' },
      ]);
      const older = new Date('2026-01-01');
      const newer = new Date('2026-02-01');
      prisma.scoreRecord.findMany.mockResolvedValueOnce([
        { studentProfileId: 's-1', percentage: 80, examId: 'e-new', createdAt: newer, exam: { scheduledDate: newer, createdAt: newer } },
        { studentProfileId: 's-2', percentage: 90, examId: 'e-new', createdAt: newer, exam: { scheduledDate: newer, createdAt: newer } },
        { studentProfileId: 's-1', percentage: 50, examId: 'e-old', createdAt: older, exam: { scheduledDate: older, createdAt: older } },
      ]);

      const summaries = await service.getBatchPerformanceSummaries('inst-1', admin);
      const batch = summaries[0]!;

      // s-1 averages (80+50)/2 = 65, s-2 averages 90 -> batch average 78.
      expect(batch.avgScore).toBe(78);
      // Most recent exam (85) beat the previous one (50) by more than 2 points.
      expect(batch.trend).toBe('up');
    });

    it('returns an empty list when the caller has no batches', async () => {
      prisma.batch.findMany.mockResolvedValueOnce([]);
      await expect(service.getBatchPerformanceSummaries('inst-1', admin)).resolves.toEqual([]);
      expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
    });
  });
});
