import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportStatus, ReportType, UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_GENERATION_QUEUE } from './report-generation.constants';
import { AuthenticatedUser } from '../auth/auth.types';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    report: { create: jest.Mock; findUnique: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let queue: { add: jest.Mock };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };
  const student: AuthenticatedUser = { ...admin, id: 'student-1', role: UserRole.STUDENT };

  beforeEach(async () => {
    prisma = {
      report: { create: jest.fn(), findUnique: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(REPORT_GENERATION_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  describe('requestReport', () => {
    it('rejects a student requesting a report', async () => {
      await expect(
        service.requestReport('inst-1', { type: ReportType.CLASS_REPORT, scope: {} }, student),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects a teacher requesting a report for a batch they don't teach", async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.requestReport('inst-1', { type: ReportType.CLASS_REPORT, scope: { batchId: 'batch-1' } }, teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('queues a QUEUED report and a generation job for a valid request', async () => {
      prisma.report.create.mockResolvedValueOnce({ id: 'report-1', status: ReportStatus.QUEUED });

      const result = await service.requestReport('inst-1', { type: ReportType.REPORT_CARD, scope: { studentId: 's-1' } }, admin);

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ReportStatus.QUEUED, requestedByUserId: 'admin-1' }) }),
      );
      expect(queue.add).toHaveBeenCalledWith('generate', { reportId: 'report-1' }, expect.any(Object));
      expect(result.status).toBe(ReportStatus.QUEUED);
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
});
