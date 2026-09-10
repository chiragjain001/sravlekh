import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AttendanceService — tenant isolation and RBAC (13-TESTING-STRATEGY.md §7)', () => {
  let service: AttendanceService;
  let prisma: {
    batch: { findUnique: jest.Mock };
    studentProfile: { findMany: jest.Mock };
    attendanceRecord: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      batch: { findUnique: jest.fn() },
      studentProfile: { findMany: jest.fn() },
      attendanceRecord: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (ops: any) => Array.isArray(ops) ? Promise.all(ops) : ops),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttendanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AttendanceService);
  });

  describe('markAttendance', () => {
    const dto = { batchId: 'batch-1', date: '2026-08-24', entries: [{ studentProfileId: 's1', status: AttendanceStatus.PRESENT }] };

    it('rejects a TEACHER marking a batch they are not assigned to', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-OTHER' }]);

      await expect(service.markAttendance('inst-1', dto, teacher)).rejects.toThrow(ForbiddenException);
      expect(prisma.batch.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a batch from a different institute', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-OTHER' });
      await expect(service.markAttendance('inst-1', dto, admin)).rejects.toThrow(NotFoundException);
    });

    it('rejects a student not enrolled in the target batch', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1' });
      prisma.studentProfile.findMany.mockResolvedValueOnce([]); // s1 not found in this batch

      await expect(service.markAttendance('inst-1', dto, admin)).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty entries array', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1' });
      await expect(service.markAttendance('inst-1', { ...dto, entries: [] }, admin)).rejects.toThrow(BadRequestException);
    });

    it('upserts each entry keyed on the compound unique constraint and writes an audit entry', async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-1' });
      prisma.studentProfile.findMany.mockResolvedValueOnce([{ id: 's1' }]);
      (prisma as any).attendanceRecord.upsert = jest.fn().mockResolvedValue({ id: 'ar-1' });

      const result = await service.markAttendance('inst-1', dto, admin);

      expect((prisma as any).attendanceRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentProfileId_batchId_date: { studentProfileId: 's1', batchId: 'batch-1', date: new Date('2026-08-24') } },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(result.records).toHaveLength(1);
    });
  });

  describe('correctAttendance', () => {
    const dto = { status: AttendanceStatus.PRESENT, reason: 'Marked absent by mistake' };

    it('404s for a nonexistent record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce(null);
      await expect(service.correctAttendance('inst-1', 'ar-1', dto, admin)).rejects.toThrow(NotFoundException);
    });

    it('rejects a record whose batch belongs to a different institute', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce({ id: 'ar-1', batchId: 'batch-1', batch: { id: 'batch-1', instituteId: 'inst-OTHER' } });
      await expect(service.correctAttendance('inst-1', 'ar-1', dto, admin)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a TEACHER correcting a record outside their assigned batches', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce({ id: 'ar-1', batchId: 'batch-1', batch: { id: 'batch-1', instituteId: 'inst-1' } });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-OTHER' }]);

      await expect(service.correctAttendance('inst-1', 'ar-1', dto, teacher)).rejects.toThrow(ForbiddenException);
    });

    it('sets correctedAt/correctionReason and writes an audit entry', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce({ id: 'ar-1', batchId: 'batch-1', status: AttendanceStatus.ABSENT, batch: { id: 'batch-1', instituteId: 'inst-1' } });
      prisma.attendanceRecord.update.mockResolvedValueOnce({ id: 'ar-1', status: AttendanceStatus.PRESENT, correctedAt: new Date(), correctionReason: dto.reason });

      const result = await service.correctAttendance('inst-1', 'ar-1', dto, admin);

      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'ar-1' },
        data: expect.objectContaining({ status: AttendanceStatus.PRESENT, correctionReason: dto.reason }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(result.correctionReason).toBe(dto.reason);
    });
  });

  describe('findAll — teacher batch scoping', () => {
    it('restricts a TEACHER to their assigned batches only', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([]);
      prisma.attendanceRecord.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', {} as any, teacher);

      const call = prisma.attendanceRecord.findMany.mock.calls[0]![0];
      expect(call.where.batchId).toEqual({ in: ['batch-1'] });
    });
  });

  describe('getSummary', () => {
    it('computes real percentages: PRESENT/LATE count as attended, EXCUSED is removed from the denominator', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { status: AttendanceStatus.PRESENT, batchId: 'b1', studentProfileId: 's1', batch: { name: 'Alpha' }, studentProfile: { rollNumber: '01', user: { name: 'Aarav' } } },
        { status: AttendanceStatus.LATE, batchId: 'b1', studentProfileId: 's1', batch: { name: 'Alpha' }, studentProfile: { rollNumber: '01', user: { name: 'Aarav' } } },
        { status: AttendanceStatus.ABSENT, batchId: 'b1', studentProfileId: 's1', batch: { name: 'Alpha' }, studentProfile: { rollNumber: '01', user: { name: 'Aarav' } } },
        { status: AttendanceStatus.EXCUSED, batchId: 'b1', studentProfileId: 's1', batch: { name: 'Alpha' }, studentProfile: { rollNumber: '01', user: { name: 'Aarav' } } },
      ]);

      const summary = await service.getSummary('inst-1', {}, admin);

      // 2 attended (PRESENT+LATE) out of 3 counted (excludes the 1 EXCUSED) = 67%
      expect(summary.byBatch).toEqual([{ batchId: 'b1', batchName: 'Alpha', totalMarked: 3, attendancePct: 67 }]);
      expect(summary.overallAttendancePct).toBe(67);
      expect(summary.statusBreakdown).toEqual({ PRESENT: 1, ABSENT: 1, LATE: 1, EXCUSED: 1 });
      // byStudent only populated when a specific batchId is queried
      expect(summary.byStudent).toEqual([]);
    });

    it('populates byStudent only when scoped to a single batch', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { status: AttendanceStatus.ABSENT, batchId: 'b1', studentProfileId: 's1', batch: { name: 'Alpha' }, studentProfile: { rollNumber: '01', user: { name: 'Aarav' } } },
      ]);

      const summary = await service.getSummary('inst-1', { batchId: 'b1' }, admin);

      expect(summary.byStudent).toEqual([{ studentProfileId: 's1', name: 'Aarav', rollNumber: '01', totalMarked: 1, attendancePct: 0 }]);
    });
  });
});
