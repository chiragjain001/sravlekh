import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';
import { ATTENDANCE_CHECK_QUEUE, AttendanceCheckJobData } from './attendance.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';

@Processor(ATTENDANCE_CHECK_QUEUE, workerOptions(QUEUE_POLICY.attendanceMissingCheck))
export class AttendanceMissingCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceMissingCheckProcessor.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<AttendanceCheckJobData>): Promise<void> {
    if (job.data?.instituteId) {
      await this.attendanceService.detectAndAlertMissingSessions(job.data.instituteId);
    } else {
      const institutes = await this.prisma.institute.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      for (const inst of institutes) {
        try {
          await this.attendanceService.detectAndAlertMissingSessions(inst.id);
        } catch (err) {
          this.logger.error(`Failed to process missing attendance for institute ${inst.id}`, err);
        }
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AttendanceCheckJobData> | undefined, err: Error) {
    reportDeadLetter('attendance-missing-check', job, err, this.logger, { instituteId: job?.data?.instituteId });
  }
}
