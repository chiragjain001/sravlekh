import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportGenerationProcessor } from './report-generation.processor';
import { REPORT_GENERATION_QUEUE } from './report-generation.constants';

@Module({
  imports: [BullModule.registerQueue({ name: REPORT_GENERATION_QUEUE })],
  controllers: [ReportsController],
  providers: [ReportsService, ReportGenerationProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
