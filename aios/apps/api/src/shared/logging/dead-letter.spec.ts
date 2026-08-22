import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Job } from 'bullmq';
import { reportDeadLetter } from './dead-letter';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

describe('reportDeadLetter', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  function makeJob(overrides: Partial<Job> = {}): Job {
    return {
      id: 'job-1',
      attemptsMade: 1,
      opts: { attempts: 3 },
      ...overrides,
    } as Job;
  }

  it('does nothing when the job is undefined (BullMQ can pass this)', () => {
    reportDeadLetter('test-queue', undefined, new Error('x'), logger);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('only warns, never reaches Sentry, while retries remain', () => {
    const job = makeJob({ attemptsMade: 1, opts: { attempts: 3 } });
    reportDeadLetter('test-queue', job, new Error('boom'), logger);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('will retry'));
    expect(logger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('logs at error level AND forwards to Sentry once retries are exhausted (12 §7 dead-letter alert)', () => {
    const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });
    const err = new Error('boom');
    reportDeadLetter('test-queue', job, err, logger, { studentProfileId: 'sp-1' });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('dead-lettered'), err.stack);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { queue: 'test-queue', jobId: 'job-1', deadLettered: 'true' },
      extra: { studentProfileId: 'sp-1' },
    });
  });

  it('treats attemptsMade exceeding the configured attempts as exhausted too', () => {
    const job = makeJob({ attemptsMade: 5, opts: { attempts: 3 } });
    reportDeadLetter('test-queue', job, new Error('boom'), logger);
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
