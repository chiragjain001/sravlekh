import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';

@Module({
  imports: [BullModule.registerQueue({ name: MASTERY_RECALC_QUEUE })],
  controllers: [HealthController],
})
export class HealthModule {}
