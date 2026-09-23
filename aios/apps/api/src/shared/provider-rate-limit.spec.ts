import { DelayedError } from 'bullmq';
import { ProviderRateLimitError, deferIfRateLimited, rateLimitFrom } from './provider-rate-limit';

function axios429(retryAfter?: string) {
  return { isAxiosError: true, response: { status: 429, headers: retryAfter ? { 'retry-after': retryAfter } : {} } };
}

describe('provider rate limiting', () => {
  describe('rateLimitFrom', () => {
    it("uses the provider's own Retry-After", () => {
      expect(rateLimitFrom(axios429('37'))?.retryAfterMs).toBe(37_000);
    });

    it('falls back to a sane wait when the header is missing or nonsense', () => {
      expect(rateLimitFrom(axios429())?.retryAfterMs).toBe(30_000);
      expect(rateLimitFrom(axios429('soon'))?.retryAfterMs).toBe(30_000);
    });

    it('caps an absurd wait so a job cannot be parked for an hour', () => {
      expect(rateLimitFrom(axios429('99999'))?.retryAfterMs).toBe(300_000);
    });

    it('is not a rate limit when the status is anything else', () => {
      expect(rateLimitFrom({ isAxiosError: true, response: { status: 500, headers: {} } })).toBeNull();
      expect(rateLimitFrom(new Error('socket hang up'))).toBeNull();
    });
  });

  describe('deferIfRateLimited', () => {
    const job = () => ({ id: 'job-1', moveToDelayed: jest.fn().mockResolvedValue(undefined) });

    it('reschedules the job for later instead of failing it, keeping its attempts', async () => {
      const j = job();
      const before = Date.now();
      await expect(deferIfRateLimited(j as never, new ProviderRateLimitError(37_000), 'tok', () => {})).rejects.toBeInstanceOf(DelayedError);

      expect(j.moveToDelayed).toHaveBeenCalledTimes(1);
      const [runAt, token] = j.moveToDelayed.mock.calls[0]!;
      expect(token).toBe('tok');
      expect(runAt).toBeGreaterThanOrEqual(before + 37_000);
    });

    it('leaves an ordinary failure to the queue’s normal retry policy', async () => {
      const j = job();
      await expect(deferIfRateLimited(j as never, new Error('python down'), 'tok', () => {})).resolves.toBeUndefined();
      expect(j.moveToDelayed).not.toHaveBeenCalled();
    });

    it('cannot defer without the worker token, so the job fails normally', async () => {
      const j = job();
      await expect(deferIfRateLimited(j as never, new ProviderRateLimitError(1000), undefined, () => {})).resolves.toBeUndefined();
      expect(j.moveToDelayed).not.toHaveBeenCalled();
    });
  });
});
