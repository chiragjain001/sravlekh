import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';
import { CheckedCopyController } from './checked-copy.controller';
import { CheckedCopyService } from './checked-copy.service';
import { ScoreAggregationService } from './score-aggregation.service';
import { ScoreAggregationProcessor } from './score-aggregation.processor';
import { SCORE_AGGREGATION_QUEUE } from './score-aggregation.constants';
import { AiEvaluationModule } from '../ai-evaluation/ai-evaluation.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';

import { CopyCheckerAssignmentsController } from './copy-checker-assignments.controller';
import { CopyCheckerAssignmentsService } from './copy-checker-assignments.service';

@Module({
  imports: [BullModule.registerQueue({ name: SCORE_AGGREGATION_QUEUE }), AiEvaluationModule, PermissionsModule, ReportsModule, AnalyticsModule],
  controllers: [EvaluationsController, CheckedCopyController, CopyCheckerAssignmentsController],
  providers: [EvaluationsService, CheckedCopyService, ScoreAggregationService, ScoreAggregationProcessor, CopyCheckerAssignmentsService],
  exports: [EvaluationsService, CopyCheckerAssignmentsService],
})
export class EvaluationsModule {}
