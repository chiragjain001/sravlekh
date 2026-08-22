import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import RedisMock from 'ioredis';
import { CacheService } from './cache.service';

const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scanStream: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedisInstance));

describe('CacheService (09-CACHING-STRATEGY.md §5: fail-open, never fail-closed)', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService, { provide: ConfigService, useValue: { get: () => undefined } }],
    }).compile();
    service = module.get(CacheService);
  });

  describe('offline-queue configuration (regression: a hung Redis connection must never hang a request)', () => {
    it('disables ioredis offline queueing, so a call while disconnected rejects immediately instead of hanging forever', () => {
      // ioredis's default (enableOfflineQueue: true) queues commands issued
      // while disconnected rather than rejecting them — with that default, a
      // genuinely-down Redis would make every get()/set() call hang forever
      // instead of throwing, so the try/catch fail-open logic in every method
      // above would never fire and a request would block indefinitely. This
      // was caught by hand (the API hung on every request once this service
      // was wired into real endpoints, against a sandbox with no reachable
      // Redis) — asserting the config here so it can't silently regress.
      const ctorArgs = (RedisMock as unknown as jest.Mock).mock.calls[0];
      expect(ctorArgs[1]).toMatchObject({ enableOfflineQueue: false });
    });
  });

  describe('get', () => {
    it('returns the parsed value on a hit', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ foo: 'bar' }));
      await expect(service.get('key-1')).resolves.toEqual({ foo: 'bar' });
    });

    it('returns undefined (not throw) on a miss', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);
      await expect(service.get('key-1')).resolves.toBeUndefined();
    });

    it('fails open: a Redis read error returns undefined instead of throwing', async () => {
      mockRedisInstance.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.get('key-1')).resolves.toBeUndefined();
    });
  });

  describe('set', () => {
    it('sets the key with the given TTL', async () => {
      mockRedisInstance.set.mockResolvedValueOnce('OK');
      await service.set('key-1', { foo: 'bar' }, 300);
      expect(mockRedisInstance.set).toHaveBeenCalledWith('key-1', JSON.stringify({ foo: 'bar' }), 'EX', 300);
    });

    it('fails open: a write error does not throw', async () => {
      mockRedisInstance.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.set('key-1', {}, 60)).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('fails open: a delete error does not throw', async () => {
      mockRedisInstance.del.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.del('key-1')).resolves.toBeUndefined();
    });
  });

  describe('delByPrefix', () => {
    it('deletes every key returned by the scan stream', async () => {
      mockRedisInstance.scanStream.mockReturnValueOnce(
        (async function* () {
          yield ['academics-tree:inst-1:a', 'academics-tree:inst-1:b'];
        })(),
      );
      mockRedisInstance.del.mockResolvedValueOnce(2);

      await service.delByPrefix('academics-tree:inst-1');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('academics-tree:inst-1:a', 'academics-tree:inst-1:b');
    });

    it('fails open on a scan error', async () => {
      mockRedisInstance.scanStream.mockImplementationOnce(() => {
        throw new Error('ECONNREFUSED');
      });
      await expect(service.delByPrefix('academics-tree:inst-1')).resolves.toBeUndefined();
    });
  });
});
