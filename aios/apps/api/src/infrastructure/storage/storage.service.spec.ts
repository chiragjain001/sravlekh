import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  async function build(env: Record<string, string | undefined>): Promise<StorageService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      ],
    }).compile();
    return module.get(StorageService);
  }

  it('builds tenant-scoped keys, always prefixed institutes/{instituteId}', async () => {
    const service = await build({});
    expect(service.buildKey('inst-1', 'documents', 'doc-1', 'raw.jpg')).toBe(
      'institutes/inst-1/documents/doc-1/raw.jpg',
    );
  });

  it('rejects upload/download/delete calls when S3 env vars are missing, rather than silently no-op-ing', async () => {
    const service = await build({});
    await expect(service.upload('k', Buffer.from(''), 'image/jpeg')).rejects.toThrow(/not configured/);
    await expect(service.getSignedDownloadUrl('k')).rejects.toThrow(/not configured/);
    await expect(service.delete('k')).rejects.toThrow(/not configured/);
  });
});
