import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { ATTENDANCE_CHECK_QUEUE } from './attendance.constants';
import { AttendanceMissingCheckProcessor } from './attendance-missing-check.processor';
import { AttendanceMissingCheckScheduler } from './attendance-missing-check.scheduler';

@Module({
  imports: [
    PermissionsModule,
    BullModule.registerQueue({ name: ATTENDANCE_CHECK_QUEUE }),
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceMissingCheckProcessor,
    AttendanceMissingCheckScheduler,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}

