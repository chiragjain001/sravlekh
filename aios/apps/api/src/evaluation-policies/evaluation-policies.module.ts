import { Module } from '@nestjs/common';
import { EvaluationPoliciesService } from './evaluation-policies.service';
import { EvaluationPoliciesController } from './evaluation-policies.controller';

@Module({
  controllers: [EvaluationPoliciesController],
  providers: [EvaluationPoliciesService],
  exports: [EvaluationPoliciesService],
})
export class EvaluationPoliciesModule {}
