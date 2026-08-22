import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AiEvaluationService } from './ai-evaluation.service';
import { AI_EVALUATION_QUEUE } from './ai-evaluation.constants';

jest.mock('axios');
import axios from 'axios';

describe('AiEvaluationService', () => {
  let service: AiEvaluationService;
  let queue: { add: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    config = { get: jest.fn((key: string) => (key === 'PYTHON_SERVICE_URL' ? 'http://python:8000' : 'internal-token-1')) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiEvaluationService,
        { provide: ConfigService, useValue: config },
        { provide: getQueueToken(AI_EVALUATION_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(AiEvaluationService);
    (axios.post as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  it('enqueues a single-response job with type=single', async () => {
    await service.enqueueSingle('inst-1', 'resp-1', 'user-1');
    expect(queue.add).toHaveBeenCalledWith(
      'single',
      { type: 'single', instituteId: 'inst-1', responseId: 'resp-1', requestedByUserId: 'user-1' },
      expect.any(Object),
    );
  });

  it('enqueues a batch job with type=batch and fewer retry attempts than single', async () => {
    await service.enqueueBatch('inst-1', 'delivery-1', 'user-1');
    const [, , opts] = queue.add.mock.calls[0];
    expect(queue.add).toHaveBeenCalledWith(
      'batch',
      { type: 'batch', instituteId: 'inst-1', assessmentDeliveryId: 'delivery-1', requestedByUserId: 'user-1' },
      expect.any(Object),
    );
    expect(opts.attempts).toBe(2);
  });

  it('posts a single evaluation request to the internal FastAPI endpoint', async () => {
    await service.requestSingleEvaluation({ type: 'single', instituteId: 'inst-1', responseId: 'resp-1', requestedByUserId: 'user-1' });
    expect(axios.post).toHaveBeenCalledWith(
      'http://python:8000/evaluation/ai-evaluate',
      { instituteId: 'inst-1', responseId: 'resp-1', requestedByUserId: 'user-1' },
      expect.objectContaining({ headers: { 'X-Internal-Token': 'internal-token-1' } }),
    );
  });

  it('posts a batch evaluation request with a long timeout matching the 15-minute p95 target', async () => {
    await service.requestBatchEvaluation({ type: 'batch', instituteId: 'inst-1', assessmentDeliveryId: 'delivery-1', requestedByUserId: 'user-1' });
    expect(axios.post).toHaveBeenCalledWith(
      'http://python:8000/evaluation/ai-evaluate-batch',
      { instituteId: 'inst-1', assessmentDeliveryId: 'delivery-1', requestedByUserId: 'user-1' },
      expect.objectContaining({ timeout: 20 * 60_000 }),
    );
  });

  it('rethrows on failure so the queue retries', async () => {
    (axios.post as jest.Mock).mockRejectedValueOnce(new Error('down'));
    await expect(
      service.requestSingleEvaluation({ type: 'single', instituteId: 'inst-1', responseId: 'resp-1', requestedByUserId: 'user-1' }),
    ).rejects.toThrow('down');
  });
});
