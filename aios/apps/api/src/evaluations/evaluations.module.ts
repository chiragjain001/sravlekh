import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';
import { ScoreAggregationService } from './score-aggregation.service';
import { ScoreAggregationProcessor } from './score-aggregation.processor';
import { SCORE_AGGREGATION_QUEUE } from './score-aggregation.constants';
import { AiEvaluationModule } from '../ai-evaluation/ai-evaluation.module';

@Module({
  imports: [BullModule.registerQueue({ name: SCORE_AGGREGATION_QUEUE }), AiEvaluationModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, ScoreAggregationService, ScoreAggregationProcessor],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
