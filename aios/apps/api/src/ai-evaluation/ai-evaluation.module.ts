import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiEvaluationService } from './ai-evaluation.service';
import { AiEvaluationProcessor } from './ai-evaluation.processor';
import { AI_EVALUATION_QUEUE } from './ai-evaluation.constants';

@Module({
  imports: [BullModule.registerQueue({ name: AI_EVALUATION_QUEUE })],
  providers: [AiEvaluationService, AiEvaluationProcessor],
  exports: [AiEvaluationService],
})
export class AiEvaluationModule {}
