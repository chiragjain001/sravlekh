import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FounderService } from './founder.service';
import { FounderController } from './founder.controller';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { SupportTicketsModule } from '../support-tickets/support-tickets.module';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';
import { AI_EVALUATION_QUEUE } from '../ai-evaluation/ai-evaluation.constants';
import { SCORE_AGGREGATION_QUEUE } from '../evaluations/score-aggregation.constants';
import { NOTICE_DISPATCH_QUEUE } from '../notices/notice-dispatch.constants';
import { OCR_QUEUE } from '../ocr/ocr.constants';
import { REPORT_GENERATION_QUEUE } from '../reports/report-generation.constants';

@Module({
  imports: [
    AuditModule,
    UsersModule,
    SupportTicketsModule,
    // Founder Console Phase 6 — read-only access to every queue's job counts
    // (waiting/active/failed/delayed) for GET /founder/health/queues. Each
    // BullModule.registerQueue call here reuses the same named Bull queue the
    // owning module already registered (same Redis connection, same jobs) —
    // this does not create a second queue, only a second injectable handle.
    BullModule.registerQueue(
      { name: MASTERY_RECALC_QUEUE },
      { name: AI_EVALUATION_QUEUE },
      { name: SCORE_AGGREGATION_QUEUE },
      { name: NOTICE_DISPATCH_QUEUE },
      { name: OCR_QUEUE },
      { name: REPORT_GENERATION_QUEUE },
    ),
  ],
  controllers: [FounderController],
  providers: [FounderService],
})
export class FounderModule {}
