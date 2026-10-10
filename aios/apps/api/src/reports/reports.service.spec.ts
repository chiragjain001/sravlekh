import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReportStatus, ReportType, UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_GENERATION_QUEUE } from './report-generation.constants';
import { StorageService } from '../infrastructure/storage/storage.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    report: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let queue: { add: jest.Mock };
  let storage: { buildKey: jest.Mock; getSignedDownloadUrl: jest.Mock };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };
  const student: AuthenticatedUser = { ...admin, id: 'student-1', role: UserRole.STUDENT };

  beforeEach(async () => {
    prisma = {
      report: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      teacherProfile: { findUnique: jest.fn(), findFirst: jest.fn() },
      studentProfile: { findFirst: jest.fn() },
      batch: { findFirst: jest.fn() },
      batchTeacher: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    } as any;
    queue = { add: jest.fn() };
    storage = {
      buildKey: jest.fn((instituteId: string, ...segments: string[]) => ['institutes', instituteId, ...segments].join('/')),
      getSignedDownloadUrl: jest.fn(async (key: string) => `https://signed.test/${key}?exp=fresh`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: getQueueToken(REPORT_GENERATION_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  describe('requestReport', () => {
    it('rejects a student requesting a report', async () => {
      await expect(
        service.requestReport('inst-1', { type: ReportType.CLASS_REPORT, scope: { batchId: 'batch-1' } }, student),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a report with missing required scope', async () => {
      await expect(
        service.requestReport('inst-1', { type: ReportType.REPORT_CARD, scope: {} }, admin),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.requestReport('inst-1', { type: ReportType.CLASS_REPORT, scope: {} }, admin),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.requestReport('inst-1', { type: ReportType.TEACHER_REPORT, scope: {} }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a studentId that does not exist or belongs to another institute', async () => {
      (prisma as any).studentProfile.findFirst = jest.fn().mockResolvedValueOnce(null);
      await expect(
        service.requestReport('inst-1', { type: ReportType.REPORT_CARD, scope: { studentId: 'foreign-stu' } }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a batchId that does not exist or belongs to another institute', async () => {
      (prisma as any).batch.findFirst = jest.fn().mockResolvedValueOnce(null);
      await expect(
        service.requestReport('inst-1', { type: ReportType.CLASS_REPORT, scope: { batchId: 'foreign-batch' } }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an inverted date range (dateFrom > dateTo)', async () => {
      (prisma as any).studentProfile.findFirst = jest.fn().mockResolvedValueOnce({ id: 's-1', instituteId: 'inst-1' });
      await expect(
        service.requestReport(
          'inst-1',
          { type: ReportType.REPORT_CARD, scope: { studentId: 's-1', dateFrom: '2026-10-10', dateTo: '2026-10-01' } },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a teacher requesting a report for a batch they don't teach", async () => {
      (prisma as any).batch.findFirst = jest.fn().mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.requestReport('inst-1', { type: ReportType.CLASS_REPORT, scope: { batchId: 'batch-1' } }, teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('queues a QUEUED report and a generation job for a valid request', async () => {
      (prisma as any).studentProfile.findFirst = jest.fn().mockResolvedValueOnce({ id: 's-1', instituteId: 'inst-1' });
      prisma.report.create.mockResolvedValueOnce({ id: 'report-1', status: ReportStatus.QUEUED });

      const result = await service.requestReport('inst-1', { type: ReportType.REPORT_CARD, scope: { studentId: 's-1' } }, admin);

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ReportStatus.QUEUED, requestedByUserId: 'admin-1' }) }),
      );
      expect(queue.add).toHaveBeenCalledWith('generate', { reportId: 'report-1' }, expect.any(Object));
      expect(result.status).toBe(ReportStatus.QUEUED);
    });
  });

  describe('retryReport', () => {
    it('re-queues a failed report atomically', async () => {
      prisma.report.findUnique = jest.fn().mockResolvedValueOnce({ id: 'r-fail', instituteId: 'inst-1', status: ReportStatus.FAILED });
      (prisma.report as any).updateMany = jest.fn().mockResolvedValueOnce({ count: 1 });

      const result = await service.retryReport('inst-1', 'r-fail', admin);
      expect((prisma.report as any).updateMany).toHaveBeenCalledWith({
        where: { id: 'r-fail', instituteId: 'inst-1', status: ReportStatus.FAILED },
        data: { status: ReportStatus.QUEUED },
      });
      expect(queue.add).toHaveBeenCalledWith('generate', { reportId: 'r-fail' }, expect.any(Object));
      expect(result.status).toBe(ReportStatus.QUEUED);
    });

    it('rejects retrying a report that is not in FAILED status', async () => {
      prisma.report.findUnique = jest.fn().mockResolvedValueOnce({ id: 'r-comp', instituteId: 'inst-1', status: ReportStatus.COMPLETE });
      await expect(service.retryReport('inst-1', 'r-comp', admin)).rejects.toThrow(BadRequestException);
    });

    it('rejects retrying if another concurrent attempt already changed status', async () => {
      prisma.report.findUnique = jest.fn().mockResolvedValueOnce({ id: 'r-fail', instituteId: 'inst-1', status: ReportStatus.FAILED });
      (prisma.report as any).updateMany = jest.fn().mockResolvedValueOnce({ count: 0 });

      await expect(service.retryReport('inst-1', 'r-fail', admin)).rejects.toThrow(BadRequestException);
    });

    it('rejects retrying a report belonging to another institute', async () => {
      prisma.report.findUnique = jest.fn().mockResolvedValueOnce({ id: 'r-foreign', instituteId: 'inst-2', status: ReportStatus.FAILED });
      await expect(service.retryReport('inst-1', 'r-foreign', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reissueForStudent — 31-EVALUATION-AUDIT-VERSIONING.md §4', () => {
    it('does nothing when no COMPLETE report covers this student', async () => {
      prisma.report.findMany.mockResolvedValueOnce([]);
      await service.reissueForStudent('inst-1', 'sp-1', 'admin-1');
      expect(prisma.report.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('creates a superseding QUEUED report and enqueues regeneration for each affected report', async () => {
      prisma.report.findMany.mockResolvedValueOnce([
        { id: 'report-old-1', type: ReportType.REPORT_CARD, scope: { studentId: 'sp-1' }, format: 'PDF' },
      ]);
      prisma.report.create.mockResolvedValueOnce({ id: 'report-new-1' });

      await service.reissueForStudent('inst-1', 'sp-1', 'admin-1');

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ReportStatus.QUEUED, supersedesReportId: 'report-old-1' }) }),
      );
      expect(queue.add).toHaveBeenCalledWith('generate', { reportId: 'report-new-1' }, expect.any(Object));
    });

    it('only queries reports scoped to this exact student, not already superseded', async () => {
      prisma.report.findMany.mockResolvedValueOnce([]);
      await service.reissueForStudent('inst-1', 'sp-1', 'admin-1');
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instituteId: 'inst-1',
            status: ReportStatus.COMPLETE,
            scope: { path: ['studentId'], equals: 'sp-1' },
            supersededBy: null,
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('404s for a report in a different institute', async () => {
      prisma.report.findUnique.mockResolvedValueOnce({ id: 'r-1', instituteId: 'inst-2', requestedByUserId: 'admin-1' });
      await expect(service.findById('inst-1', 'r-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('rejects a teacher reading a report they did not request', async () => {
      prisma.report.findUnique.mockResolvedValueOnce({ id: 'r-1', instituteId: 'inst-1', requestedByUserId: 'someone-else' });
      await expect(service.findById('inst-1', 'r-1', teacher)).rejects.toThrow(ForbiddenException);
    });
  });

  // Signed URLs expire in 5 minutes, so the one the worker minted at
  // completion is dead long before anyone clicks "View Report" — every
  // finished report had a download link that 503'd. Re-minted per read.
  describe('download URLs', () => {
    const completed = {
      id: 'r-1',
      instituteId: 'inst-1',
      requestedByUserId: 'admin-1',
      status: ReportStatus.COMPLETE,
      fileUrl: 'https://signed.test/stale?exp=long-gone',
    };

    it('re-mints the download URL on read rather than serving the stored, expired one', async () => {
      prisma.report.findUnique.mockResolvedValueOnce(completed);

      const result = await service.findById('inst-1', 'r-1', admin);

      expect(storage.buildKey).toHaveBeenCalledWith('inst-1', 'reports', 'r-1.html');
      expect(result.fileUrl).toBe('https://signed.test/institutes/inst-1/reports/r-1.html?exp=fresh');
      expect(result.fileUrl).not.toBe(completed.fileUrl);
    });

    it('re-mints for every row in the list, not just a single read', async () => {
      prisma.report.findMany.mockResolvedValueOnce([completed, { ...completed, id: 'r-2' }]);
      (prisma.report as any).count = jest.fn().mockResolvedValueOnce(2);

      const { data } = await service.findAll('inst-1', {}, admin);

      expect(data.map((r: any) => r.fileUrl)).toEqual([
        'https://signed.test/institutes/inst-1/reports/r-1.html?exp=fresh',
        'https://signed.test/institutes/inst-1/reports/r-2.html?exp=fresh',
      ]);
    });

    it('leaves a report that has not completed alone — there is no file to sign yet', async () => {
      prisma.report.findUnique.mockResolvedValueOnce({ ...completed, status: ReportStatus.QUEUED, fileUrl: null });

      const result = await service.findById('inst-1', 'r-1', admin);

      expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
      expect(result.fileUrl).toBeNull();
    });
  });
});
