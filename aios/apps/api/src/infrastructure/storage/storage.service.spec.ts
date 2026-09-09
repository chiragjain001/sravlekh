import { ServiceUnavailableException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { StorageService } from './storage.service';

/**
 * The dev disk fallback exists because an unconfigured StorageService used to
 * throw a bare Error on upload, which escaped as a 500 — a student clicking
 * "Submit Work" locally got an opaque crash and lost their file.
 */
describe('StorageService — development disk fallback', () => {
  const root = resolve(process.cwd(), '.local-storage-test');
  const config = (values: Record<string, string | undefined>) =>
    ({ get: (k: string) => values[k] }) as never;

  const devService = () =>
    new StorageService(config({ NODE_ENV: 'development', JWT_SECRET: 'test-secret-key', LOCAL_STORAGE_DIR: '.local-storage-test' }));

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('stores and reads a file back through a signed URL', async () => {
    const s = devService();
    expect(s.isLocalFallbackActive()).toBe(true);

    const key = s.buildKey('inst-1', 'assignments', 'a-1', 'answer.pdf');
    await s.upload(key, Buffer.from('%PDF-1.4 hello'), 'application/pdf');

    const url = await s.getSignedDownloadUrl(key);
    const q = new URL(url).searchParams;
    expect(q.get('key')).toBe(key);

    const body = await s.readLocalSigned(key, Number(q.get('exp')), q.get('sig')!);
    expect(body.toString()).toBe('%PDF-1.4 hello');
    expect(await s.localContentType(key)).toBe('application/pdf');
  });

  it('refuses a tampered signature', async () => {
    const s = devService();
    const key = s.buildKey('inst-1', 'assignments', 'a-2', 'x.pdf');
    await s.upload(key, Buffer.from('secret'), 'application/pdf');
    const q = new URL(await s.getSignedDownloadUrl(key)).searchParams;

    await expect(s.readLocalSigned(key, Number(q.get('exp')), 'deadbeef')).rejects.toThrow(ServiceUnavailableException);
  });

  it('refuses an expired link', async () => {
    const s = devService();
    const key = s.buildKey('inst-1', 'assignments', 'a-3', 'x.pdf');
    await s.upload(key, Buffer.from('secret'), 'application/pdf');
    // Sign for a moment already past; the signature is valid but the clock is not.
    const url = await s.getSignedDownloadUrl(key, -10);
    const q = new URL(url).searchParams;

    await expect(s.readLocalSigned(key, Number(q.get('exp')), q.get('sig')!)).rejects.toThrow(/expired/i);
  });

  it('refuses a key that climbs out of the storage root', async () => {
    const s = devService();
    const q = new URL(await s.getSignedDownloadUrl('../../etc/passwd')).searchParams;
    await expect(s.readLocalSigned('../../etc/passwd', Number(q.get('exp')), q.get('sig')!)).rejects.toThrow(ServiceUnavailableException);
  });

  it('deletes a stored file', async () => {
    const s = devService();
    const key = s.buildKey('inst-1', 'assignments', 'a-4', 'x.pdf');
    await s.upload(key, Buffer.from('bye'), 'application/pdf');
    await s.delete(key);
    await expect(fs.access(join(root, key))).rejects.toBeDefined();
  });

  it('stays inactive in production and reports a configuration fault, not a crash', async () => {
    const prod = new StorageService(config({ NODE_ENV: 'production', JWT_SECRET: 'x' }));
    expect(prod.isLocalFallbackActive()).toBe(false);
    await expect(prod.upload('k', Buffer.from('x'), 'text/plain')).rejects.toThrow(ServiceUnavailableException);
  });

  it('prefers real S3 over the fallback when it is configured', () => {
    const s3 = new StorageService(
      config({ NODE_ENV: 'development', S3_BUCKET: 'b', AWS_REGION: 'r', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' }),
    );
    expect(s3.isLocalFallbackActive()).toBe(false);
    expect(s3.isConfigured()).toBe(true);
  });
});
