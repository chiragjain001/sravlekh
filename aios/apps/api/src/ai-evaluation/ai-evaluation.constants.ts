export const AI_EVALUATION_QUEUE = 'ai-evaluation';

export interface AiEvaluationSingleJobData {
  type: 'single';
  instituteId: string;
  responseId: string;
  requestedByUserId: string;
}

export interface AiEvaluationBatchJobData {
  type: 'batch';
  instituteId: string;
  assessmentDeliveryId: string;
  requestedByUserId: string;
}

export type AiEvaluationJobData = AiEvaluationSingleJobData | AiEvaluationBatchJobData;
