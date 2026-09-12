import { poolLimitOptions, PrismaService } from './prisma.service';

/**
 * Pool sizing is opt-in, and the default path must stay byte-for-byte what
 * Prisma saw before this option existed — an accidental datasource override
 * would repoint the database for every process that boots.
 */
describe('poolLimitOptions', () => {
  const url = 'postgresql://u:p@db.internal:5432/aios';

  it('returns undefined when no limit is configured', () => {
    expect(poolLimitOptions(url, undefined)).toBeUndefined();
  });

  it('returns undefined when there is no DATABASE_URL to modify', () => {
    expect(poolLimitOptions(undefined, '20')).toBeUndefined();
  });

  it('appends connection_limit when configured', () => {
    const opts = poolLimitOptions(url, '20');
    expect(new URL(opts!.datasources.db.url).searchParams.get('connection_limit')).toBe('20');
  });

  it('preserves existing query parameters', () => {
    // Supabase and friends carry pgbouncer/sslmode flags that must survive.
    const opts = poolLimitOptions(`${url}?sslmode=require&pgbouncer=true`, '5');
    const params = new URL(opts!.datasources.db.url).searchParams;
    expect(params.get('sslmode')).toBe('require');
    expect(params.get('pgbouncer')).toBe('true');
    expect(params.get('connection_limit')).toBe('5');
  });

  it('never overrides a connection_limit already written into the URL', () => {
    // Someone who put it in the URL meant it; the env var must not silently win.
    expect(poolLimitOptions(`${url}?connection_limit=3`, '99')).toBeUndefined();
  });

  it('leaves a malformed URL to env validation rather than mangling it', () => {
    expect(poolLimitOptions('not-a-url', '20')).toBeUndefined();
  });
});

describe('PrismaService construction', () => {
  const saved = { url: process.env['DATABASE_URL'], limit: process.env['DATABASE_POOL_LIMIT'] };

  afterEach(() => {
    process.env['DATABASE_URL'] = saved.url;
    if (saved.limit === undefined) delete process.env['DATABASE_POOL_LIMIT'];
    else process.env['DATABASE_POOL_LIMIT'] = saved.limit;
  });

  it('constructs when a pool limit is set — Prisma accepts the datasource override', () => {
    // The helper's unit tests only prove the string is built correctly. This
    // proves PrismaClient actually accepts that shape, which is the part that
    // would otherwise fail at boot in production rather than here. No connection
    // is opened; $connect is never called.
    process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/aios';
    process.env['DATABASE_POOL_LIMIT'] = '20';

    expect(() => new PrismaService()).not.toThrow();
  });

  it('constructs unchanged when no pool limit is set', () => {
    process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/aios';
    delete process.env['DATABASE_POOL_LIMIT'];

    expect(() => new PrismaService()).not.toThrow();
  });
});
