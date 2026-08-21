import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { MasteryRecalcProcessor, MASTERY_RECALC_QUEUE } from './mastery-recalc.processor';

@Module({
  imports: [BullModule.registerQueue({ name: MASTERY_RECALC_QUEUE })],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, MasteryRecalcProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
