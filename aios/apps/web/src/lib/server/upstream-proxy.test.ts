import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyToUpstream } from './upstream-proxy';

/**
 * Regression tests for the browser -> backend proxy.
 *
 * Each of these pins a failure that was found by actually running the proxy
 * against a real backend, not one imagined in advance. The header handling in
 * particular looks like housekeeping and is not: two of the cases below produced
 * a hard failure or silent auth corruption in practice.
 */
describe('proxyToUpstream', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const request = (url: string, init: RequestInit = {}) =>
    new NextRequest(new Request(url, init));

  const opts = { upstreamBase: 'http://api.internal:4000', upstreamPrefix: '/api/v1', label: 'API' };

  const sentHeaders = (): Headers => new Headers(fetchMock.mock.calls[0][1].headers);
  const sentUrl = (): URL => new URL(String(fetchMock.mock.calls[0][0]));

  describe('URL construction', () => {
    it('reads the upstream base per call, so runtime config actually applies', async () => {
      await proxyToUpstream(request('http://web/api/v1/institutes/me'), {
        ...opts,
        path: ['institutes', 'me'],
      });
      expect(sentUrl().origin).toBe('http://api.internal:4000');

      fetchMock.mockClear();
      await proxyToUpstream(request('http://web/api/v1/institutes/me'), {
        ...opts,
        path: ['institutes', 'me'],
        upstreamBase: 'http://other.internal:9999',
      });
      expect(sentUrl().origin).toBe('http://other.internal:9999');
    });

    it('preserves the path and the query string', async () => {
      await proxyToUpstream(
        request('http://web/api/v1/analytics/batches?batchIds=b1,b2&page=2'),
        { ...opts, path: ['analytics', 'batches'] } as never,
      );
      const url = sentUrl();
      expect(url.pathname).toBe('/api/v1/analytics/batches');
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('batchIds')).toBe('b1,b2');
    });

    it.each([
      [['..', '..', 'admin', 'secrets'], 'parent traversal'],
      [['.', 'admin'], 'current-directory segment'],
      [['institutes', '..', '..', 'metrics'], 'traversal in the middle'],
      [['', 'admin'], 'empty segment'],
    ])('rejects %j (%s) with 400 and never contacts the upstream', async (path) => {
      // The hole this closes, found by this very test: encodeURIComponent does
      // NOT escape dots, so a `..` segment survived it and the URL constructor
      // resolved the traversal — `['..','..','admin','secrets']` against prefix
      // /api/v1 produced /admin/secrets, escaping the prefix entirely and
      // reaching paths on the internal host this proxy is not meant to expose.
      const res = await proxyToUpstream(request('http://web/api/v1/x'), {
        ...opts,
        path,
      } as never);

      expect(res.status).toBe(400);
      // The important half: nothing was sent upstream at all.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still allows dots inside an ordinary segment', async () => {
      // Rejecting `..` must not break legitimate ids and filenames.
      await proxyToUpstream(request('http://web/api/v1/x'), {
        ...opts,
        path: ['documents', 'report.v2.pdf'],
      } as never);

      expect(sentUrl().pathname).toBe('/api/v1/documents/report.v2.pdf');
    });
  });

  describe('request headers', () => {
    it('forwards Authorization and Cookie', async () => {
      await proxyToUpstream(
        request('http://web/api/v1/me', {
          headers: { authorization: 'Bearer tok', cookie: 'aios_refresh_token=abc' },
        }),
        { ...opts, path: ['me'] } as never,
      );

      expect(sentHeaders().get('authorization')).toBe('Bearer tok');
      expect(sentHeaders().get('cookie')).toBe('aios_refresh_token=abc');
    });

    it('strips Expect — undici REFUSES a request carrying it', async () => {
      // The bug this pins: clients add `Expect: 100-continue` automatically once a
      // body is large enough, so forwarding it broke exactly the booklet-upload
      // path and nothing smaller. undici rejected the request with
      // "NotSupportedError: expect header not supported" and the caller got an
      // unexplained 502. Expect is per-hop and a proxy must not relay it.
      await proxyToUpstream(
        request('http://web/api/v1/upload', {
          method: 'POST',
          body: 'x',
          headers: { expect: '100-continue' },
        }),
        { ...opts, path: ['upload'] } as never,
      );

      expect(sentHeaders().has('expect')).toBe(false);
    });

    it('strips Host, so the upstream is not told it was reached at the web origin', async () => {
      await proxyToUpstream(
        request('http://web/api/v1/me', { headers: { host: 'app.example.com' } }),
        { ...opts, path: ['me'] } as never,
      );
      expect(sentHeaders().get('host')).not.toBe('app.example.com');
    });

    it.each(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length'])(
      'strips the hop-by-hop header %s',
      async (header) => {
        await proxyToUpstream(
          request('http://web/api/v1/me', { headers: { [header]: 'something' } }),
          { ...opts, path: ['me'] } as never,
        );
        expect(sentHeaders().has(header)).toBe(false);
      },
    );
  });

  describe('response handling', () => {
    it('preserves MULTIPLE Set-Cookie headers separately', async () => {
      // Headers.forEach collapses repeats into one comma-joined value, which
      // corrupts cookies whose Expires attribute contains a comma. This is
      // load-bearing for auth: a login setting both a session and a refresh
      // cookie would otherwise deliver one malformed cookie and no session.
      const upstream = new Response('{}', { status: 200 });
      upstream.headers.append('set-cookie', 'session=abc; Path=/; HttpOnly; Expires=Wed, 21 Oct 2026 07:28:00 GMT');
      upstream.headers.append('set-cookie', 'refresh=xyz; Path=/api/v1/auth; HttpOnly; SameSite=Strict');
      fetchMock.mockResolvedValueOnce(upstream);

      const res = await proxyToUpstream(request('http://web/api/v1/auth/google', { method: 'POST' }), {
        ...opts,
        path: ['auth', 'google'],
      } as never);

      const cookies = res.headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toContain('session=abc');
      expect(cookies[0]).toContain('Expires=Wed, 21 Oct 2026'); // comma intact
      expect(cookies[1]).toContain('refresh=xyz');
    });

    it('passes a 204 through without a body instead of throwing', async () => {
      // Constructing a Response with a body and a null-body status throws at
      // runtime, which would turn a valid upstream 204 into a 500 from the proxy.
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const res = await proxyToUpstream(
        request('http://web/api/v1/notices/n1', { method: 'DELETE' }),
        { ...opts, path: ['notices', 'n1'] } as never,
      );

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it('passes upstream error statuses through unchanged', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
      );

      const res = await proxyToUpstream(request('http://web/api/v1/admin'), {
        ...opts,
        path: ['admin'],
      } as never);

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toMatchObject({ message: 'Forbidden' });
    });

    it('never follows an upstream redirect', async () => {
      // This server holds the caller's Authorization header and cookies. Following
      // a 3xx would let a misconfigured or compromised upstream steer them at an
      // arbitrary host.
      await proxyToUpstream(request('http://web/api/v1/me'), { ...opts, path: ['me'] } as never);
      expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    });
  });

  describe('upstream failure', () => {
    it('returns 502 and leaks nothing about the internal address', async () => {
      fetchMock.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 10.0.3.14:4000 (api.internal)'),
      );

      const res = await proxyToUpstream(request('http://web/api/v1/me'), {
        ...opts,
        path: ['me'],
      } as never);

      expect(res.status).toBe(502);
      const body = JSON.stringify(await res.json());
      expect(body).not.toContain('10.0.3.14');
      expect(body).not.toContain('api.internal');
      expect(body).not.toContain('ECONNREFUSED');
    });
  });

  describe('bodies', () => {
    it('does not attach a body to GET, which fetch would reject', async () => {
      await proxyToUpstream(request('http://web/api/v1/me'), { ...opts, path: ['me'] } as never);
      expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });

    it('streams a POST body rather than buffering it', async () => {
      // The upload path accepts 60 files x 10 MB. Buffering would hold up to
      // 600 MB of one booklet in this server's heap.
      await proxyToUpstream(
        request('http://web/api/v1/upload', { method: 'POST', body: 'payload' }),
        { ...opts, path: ['upload'] } as never,
      );

      const init = fetchMock.mock.calls[0][1];
      expect(init.body).toBeInstanceOf(ReadableStream);
      // Required by the spec whenever body is a stream; without it fetch throws.
      expect(init.duplex).toBe('half');
    });
  });
});
