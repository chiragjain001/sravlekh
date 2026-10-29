import { Job } from 'bullmq';
import { NoticeDispatchProcessor } from './notice-dispatch.processor';
import { NoticeDispatchService } from './notice-dispatch.service';

describe('NoticeDispatchProcessor', () => {
  let processor: NoticeDispatchProcessor;
  let dispatchService: { dispatchNotice: jest.Mock };

  beforeEach(() => {
    dispatchService = {
      dispatchNotice: jest.fn().mockResolvedValue({
        noticeId: 'notice-1',
        totalQueued: 5,
        sentCount: 5,
        failedCount: 0,
        durationMs: 120,
      }),
    };
    processor = new NoticeDispatchProcessor(dispatchService as unknown as NoticeDispatchService);
  });

  it('delegates queued jobs to NoticeDispatchService.dispatchNotice', async () => {
    const job = {
      data: { noticeId: 'notice-123' },
    } as Job;

    await processor.process(job);

    expect(dispatchService.dispatchNotice).toHaveBeenCalledWith('notice-123');
  });
});
