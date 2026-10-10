import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttendanceMissingCheckScheduler } from './attendance-missing-check.scheduler';
import { AttendanceMissingCheckProcessor } from './attendance-missing-check.processor';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { ATTENDANCE_CHECK_QUEUE } from './attendance.constants';

describe('AttendanceMissingCheckScheduler & Processor', () => {
  let scheduler: AttendanceMissingCheckScheduler;
  let processor: AttendanceMissingCheckProcessor;
  let queueMock: { add: jest.Mock };
  let attendanceServiceMock: { detectAndAlertMissingSessions: jest.Mock };
  let prismaMock: { institute: { findMany: jest.Mock } };

  beforeEach(async () => {
    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    attendanceServiceMock = {
      detectAndAlertMissingSessions: jest.fn().mockResolvedValue({ detectedCount: 1, newlyNotifiedCount: 1 }),
    };

    prismaMock = {
      institute: {
        findMany: jest.fn().mockResolvedValue([{ id: 'inst-1' }, { id: 'inst-2' }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceMissingCheckScheduler,
        AttendanceMissingCheckProcessor,
        {
          provide: getQueueToken(ATTENDANCE_CHECK_QUEUE),
          useValue: queueMock,
        },
        {
          provide: AttendanceService,
          useValue: attendanceServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    scheduler = module.get<AttendanceMissingCheckScheduler>(AttendanceMissingCheckScheduler);
    processor = module.get<AttendanceMissingCheckProcessor>(AttendanceMissingCheckProcessor);
  });

  describe('AttendanceMissingCheckScheduler', () => {
    it('registers repeatable missing attendance check job on bootstrap', async () => {
      await scheduler.onApplicationBootstrap();

      expect(queueMock.add).toHaveBeenCalledWith(
        'periodic-missing-check',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/15 * * * *' },
          jobId: 'attendance-periodic-missing-check',
          removeOnComplete: true,
          removeOnFail: true,
        }),
      );
    });
  });

  describe('AttendanceMissingCheckProcessor', () => {
    it('processes single institute job when instituteId is provided', async () => {
      const mockJob = {
        data: { instituteId: 'inst-1' },
      } as any;

      await processor.process(mockJob);

      expect(attendanceServiceMock.detectAndAlertMissingSessions).toHaveBeenCalledWith('inst-1');
      expect(prismaMock.institute.findMany).not.toHaveBeenCalled();
    });

    it('iterates through active institutes when periodic job has no specific instituteId', async () => {
      const mockJob = {
        data: {},
      } as any;

      await processor.process(mockJob);

      expect(prismaMock.institute.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      expect(attendanceServiceMock.detectAndAlertMissingSessions).toHaveBeenCalledWith('inst-1');
      expect(attendanceServiceMock.detectAndAlertMissingSessions).toHaveBeenCalledWith('inst-2');
    });
  });
});
