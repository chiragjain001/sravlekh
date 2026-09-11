import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { RefreshTokenService } from './refresh-token.service';

describe('RefreshTokenCleanupService', () => {
  let cleanupExpired: jest.Mock;
  let service: RefreshTokenCleanupService;

  beforeEach(() => {
    jest.useFakeTimers();
    cleanupExpired = jest.fn().mockResolvedValue(3);
    service = new RefreshTokenCleanupService({ cleanupExpired } as unknown as RefreshTokenService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('purges on an hourly interval once started', async () => {
    // Without this, refresh_tokens grows by ~96 rows per active user per day,
    // forever — cleanupExpired() existed but nothing called it.
    service.onModuleInit();
    expect(cleanupExpired).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(cleanupExpired).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(cleanupExpired).toHaveBeenCalledTimes(2);
  });

  it('stops on shutdown', async () => {
    service.onModuleInit();
    service.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    expect(cleanupExpired).not.toHaveBeenCalled();
  });

  it('never throws — a failed pass only delays cleanup to the next one', async () => {
    // runOnce executes inside setInterval, where an unhandled rejection would
    // take the whole process down.
    cleanupExpired.mockRejectedValueOnce(new Error('connection reset'));
    await expect(service.runOnce()).resolves.toBe(0);
  });
});
