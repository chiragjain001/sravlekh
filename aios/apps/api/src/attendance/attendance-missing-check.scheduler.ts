import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ATTENDANCE_CHECK_QUEUE } from './attendance.constants';
import { RUN_WORKERS } from '../infrastructure/queue/queue-policy';

@Injectable()
export class AttendanceMissingCheckScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(AttendanceMissingCheckScheduler.name);

  constructor(@InjectQueue(ATTENDANCE_CHECK_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap() {
    if (!RUN_WORKERS) return;

    try {
      // Repeatable job scheduled every 15 minutes to evaluate attendance cutoffs
      await this.queue.add(
        'periodic-missing-check',
        {},
        {
          repeat: { pattern: '*/15 * * * *' },
          removeOnComplete: true,
          removeOnFail: true,
          jobId: 'attendance-periodic-missing-check',
        },
      );
      this.logger.log('Registered repeatable missing attendance check job (every 15 min).');
    } catch (err) {
      this.logger.warn('Failed to register repeatable missing attendance job with BullMQ', err);
    }
  }
}
