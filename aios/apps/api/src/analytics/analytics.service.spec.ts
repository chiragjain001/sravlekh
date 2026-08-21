import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import axios from 'axios';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { MASTERY_RECALC_QUEUE } from './mastery-recalc.constants';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnalyticsService.requestMasteryRecalc', () => {
  let service: AnalyticsService;
  let configValues: Record<string, string | undefined>;

  async function build() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: getQueueToken(MASTERY_RECALC_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();
    return module.get(AnalyticsService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    configValues = { PYTHON_SERVICE_URL: 'http://localhost:8000' };
    service = await build();
  });

  it('calls the internal Python endpoint, not any hardcoded ai/analytics logic in Node', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await service.requestMasteryRecalc('student-1', ['topic-1', 'topic-2']);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/analytics/recalculate-mastery',
      { studentProfileId: 'student-1', topicIds: ['topic-1', 'topic-2'] },
      expect.objectContaining({ timeout: 15_000 }),
    );
  });

  it('sends the internal service token header when configured', async () => {
    configValues.INTERNAL_SERVICE_TOKEN = 'shared-secret';
    service = await build();
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await service.requestMasteryRecalc('student-1', ['topic-1']);

    const [, , options] = mockedAxios.post.mock.calls[0]!;
    expect((options as { headers?: Record<string, string> }).headers).toEqual({
      'X-Internal-Token': 'shared-secret',
    });
  });

  it('omits the token header when unconfigured (dev-only fallback)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await service.requestMasteryRecalc('student-1', ['topic-1']);

    const [, , options] = mockedAxios.post.mock.calls[0]!;
    expect((options as { headers?: unknown }).headers).toBeUndefined();
  });

  it('rethrows on failure so the BullMQ job retries', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(service.requestMasteryRecalc('student-1', ['topic-1'])).rejects.toThrow('ECONNREFUSED');
  });
});
