import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

/**
 * Transparent session refresh in the browser clients.
 *
 * The access token lives for 15 minutes, so every user hits an expired token many
 * times a day. What these tests pin is that this is invisible: one refresh, the
 * original request retried, no logout — and that when the session really is over,
 * the user is sent to /login rather than left on a screen that silently fails.
 */

type Client = typeof import('./api-client');

/** A fresh module per test — refreshInFlight is module-level state. */
async function loadClient(): Promise<Client> {
  vi.resetModules();
  return import('./api-client');
}

function unauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    data: {},
    headers: {},
    config,
  });
}

function ok(config: InternalAxiosRequestConfig, data: unknown = { ok: true }) {
  return Promise.resolve({ status: 200, statusText: 'OK', data, headers: {}, config });
}

/**
 * Backend stand-in: accepts only `Bearer fresh`, 401s anything else. So a request
 * succeeds if and only if the client refreshed and retried with the new token.
 */
const backend: AxiosAdapter = (config) =>
  String(config.headers?.Authorization) === 'Bearer fresh' ? ok(config) : unauthorized(config);

describe('api-client session refresh', () => {
  let refreshPost: MockInstance<typeof axios.post>;
  let location: { href: string };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('aios_access_token', 'expired');

    refreshPost = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { accessToken: 'fresh', user: { id: 'u1' } },
    });

    location = { href: 'http://localhost/dashboard' };
    Object.defineProperty(window, 'location', { configurable: true, value: location });
  });

  afterEach(() => vi.restoreAllMocks());

  it('refreshes on 401 and retries the original request with the new token', async () => {
    const { apiClient } = await loadClient();
    apiClient.defaults.adapter = backend;

    const res = await apiClient.get('/institutes/me');

    expect(res.status).toBe(200);
    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(refreshPost).toHaveBeenCalledWith('/api/v1/auth/refresh', {}, { withCredentials: true });
    expect(localStorage.getItem('aios_access_token')).toBe('fresh');
    expect(location.href).toBe('http://localhost/dashboard'); // no logout
  });

  it('single-flights: a burst of 401s triggers exactly ONE refresh', async () => {
    // A dashboard fires many requests at once. Each refresh rotates the token, so
    // N parallel refreshes would invalidate each other's cookie — the server's
    // grace window forgives it, but N-1 requests would fail for no reason.
    const { apiClient } = await loadClient();
    apiClient.defaults.adapter = backend;

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => apiClient.get(`/widget/${i}`)),
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refreshPost).toHaveBeenCalledTimes(1);
  });

  it('logs out cleanly when the refresh itself fails', async () => {
    refreshPost.mockRejectedValueOnce(new Error('401 from /auth/refresh'));
    const { apiClient } = await loadClient();
    apiClient.defaults.adapter = backend;

    await expect(apiClient.get('/institutes/me')).rejects.toBeInstanceOf(AxiosError);

    expect(localStorage.getItem('aios_access_token')).toBeNull();
    expect(localStorage.getItem('aios_user')).toBeNull();
    expect(location.href).toBe('/login?reason=session_expired');
  });

  it('retries at most once — a request that 401s again after refresh does not loop', async () => {
    // Refresh "succeeds" but the backend still rejects: e.g. the user was
    // suspended between the refresh and the retry.
    const { apiClient } = await loadClient();
    const alwaysUnauthorized = vi.fn<AxiosAdapter>((config) => unauthorized(config));
    apiClient.defaults.adapter = alwaysUnauthorized;

    await expect(apiClient.get('/institutes/me')).rejects.toBeInstanceOf(AxiosError);

    expect(alwaysUnauthorized).toHaveBeenCalledTimes(2); // original + one retry
    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(location.href).toBe('/login?reason=session_expired');
  });

  it('a failed refresh does not poison later ones', async () => {
    // refreshInFlight is cleared in `finally`. If it were not, one failed refresh
    // would leave a rejected promise cached and every later 401 on the page would
    // be unrecoverable.
    refreshPost.mockRejectedValueOnce(new Error('network blip'));
    const { apiClient } = await loadClient();
    apiClient.defaults.adapter = backend;

    await apiClient.get('/a').catch(() => undefined);
    localStorage.setItem('aios_access_token', 'expired');
    location.href = 'http://localhost/dashboard';

    const res = await apiClient.get('/b');
    expect(res.status).toBe(200);
    expect(refreshPost).toHaveBeenCalledTimes(2);
  });

  it('does not intercept non-401 errors', async () => {
    const { apiClient } = await loadClient();
    apiClient.defaults.adapter = (config) => {
      throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null, {
        status: 403, statusText: 'Forbidden', data: {}, headers: {}, config,
      });
    };

    await expect(apiClient.get('/admin')).rejects.toMatchObject({ response: { status: 403 } });
    expect(refreshPost).not.toHaveBeenCalled();
    expect(location.href).toBe('http://localhost/dashboard');
  });

  it('aiClient refreshes too — the Python engine rejects expired JWTs the same way', async () => {
    // Before the 401 handling was shared, an AI screen used after the 15-minute
    // token lapsed failed outright until some unrelated apiClient call happened
    // to refresh the session.
    const { aiClient } = await loadClient();
    aiClient.defaults.adapter = backend;

    const res = await aiClient.post('/generate-blueprint', {});

    expect(res.status).toBe(200);
    expect(refreshPost).toHaveBeenCalledTimes(1);
  });
});
