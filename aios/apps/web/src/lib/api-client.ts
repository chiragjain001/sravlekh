import axios, { type AxiosInstance } from 'axios';

// Demo/mock mode is a dev-only convenience for working on the UI without a live
// backend. It must never be reachable in a production build — gating on
// NODE_ENV alone isn't enough for a bundled SPA (the check would just be
// compiled away as `false`, which is exactly the point: in a production build
// this condition is statically `false` and the localStorage flag below is
// never even read). See apps/api/src/auth/auth.service.ts's loginAsMockRole
// for the equivalent server-side gate this mirrors.
const isDemoMode =
  process.env.NODE_ENV !== 'production' &&
  typeof window !== 'undefined' &&
  localStorage.getItem('aios_demo_mode') === 'true';

/**
 * Axios instance pre-configured for the AIOS API.
 */
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

if (isDemoMode) {
  apiClient.interceptors.request.use((config) => {
    // Return mock data by rejecting with a special signature we catch in response
    return Promise.reject({ __isMock: true, config });
  });
}

// Request interceptor — inject Bearer token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aios_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * In-flight refresh, shared by every caller.
 *
 * WHY SINGLE-FLIGHT: a dashboard fires many requests at once, so an expired
 * access token produces a burst of simultaneous 401s. Without this, each would
 * start its own refresh — and since every refresh ROTATES the token, the first
 * would invalidate the cookie the others are still using. The server's grace
 * window forgives that (it treats a just-rotated token as a benign race rather
 * than theft), but the client should not be generating the race in the first
 * place: N-1 of those requests would fail for no reason.
 *
 * Instead the first 401 starts one refresh and everyone else awaits the same
 * promise.
 */
let refreshInFlight: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        // Bare axios, not apiClient: going through apiClient would run this very
        // interceptor on the refresh call itself.
        //
        // withCredentials is what actually sends the httpOnly refresh cookie —
        // the browser attaches it, this code never sees it, and that is the
        // point: an XSS cannot read it either.
        const res = await axios.post<{ accessToken: string; user: unknown }>(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true },
        );
        localStorage.setItem('aios_access_token', res.data.accessToken);
        if (res.data.user) localStorage.setItem('aios_user', JSON.stringify(res.data.user));
      } finally {
        // Cleared in `finally` so a failed refresh does not leave a rejected
        // promise cached forever, which would make every later 401 unrecoverable
        // for the lifetime of the page.
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Shared 401 handling for every client that sends the access token.
 *
 * The access token is short-lived (minutes), so a 401 usually means "expired",
 * not "logged out" — and the refresh cookie is httpOnly, so this is the only place
 * that can find out. Used by BOTH apiClient and aiClient: the Python engine
 * verifies the same JWT and returns 401 on expiry too, and before this was shared
 * an AI screen used after the token lapsed simply failed until some unrelated
 * apiClient call happened to refresh the session.
 *
 * `_retried` makes this strictly one attempt per request. Without it, a refresh
 * that itself 401s would re-enter this handler and recurse. The refresh endpoint
 * is excluded outright for the same reason.
 */
async function retryAfterRefresh(error: unknown, client: AxiosInstance): Promise<unknown> {
  if (!(axios.isAxiosError(error) && error.response?.status === 401 && typeof window !== 'undefined')) {
    return Promise.reject(error);
  }

  const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
  const isRefreshCall = original?.url?.includes('/auth/refresh');

  if (original && !original._retried && !isRefreshCall) {
    original._retried = true;
    try {
      await refreshSession();
      const token = localStorage.getItem('aios_access_token');
      if (token && original.headers) {
        original.headers.Authorization = `Bearer ${token}`;
      }
      return client.request(original);
    } catch {
      // fall through to the redirect below
    }
  }

  // Refresh failed, or this request had already been retried: the session is
  // genuinely over.
  localStorage.removeItem('aios_access_token');
  localStorage.removeItem('aios_user');
  window.location.href = '/login?reason=session_expired';
  return Promise.reject(error);
}

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const err = error as Record<string, unknown>;
    if (err['__isMock']) {
      const config = err['config'] as { url?: string };
      const url = config.url || '';
      // Provide mock data based on URL
      let mockData: unknown = { data: [] };
      if (url.includes('/auth/dev-login') || url.includes('/auth/google')) {
        mockData = {
          accessToken: 'mock-demo-access-token',
          user: {
            id: 'mock-user-001',
            email: 'demo@aios.test',
            name: 'Demo User',
            role: 'TEACHER',
            instituteId: 'demo-institute-1',
          },
        };
      } else if (url.includes('/analytics/overview')) {
        mockData = { totalStudents: 1250, totalTeachers: 45, activeExams: 3 };
      } else if (url.includes('/batches')) {
        mockData = [
          { id: 'b1', name: 'JEE Target 2026', studentCount: 120, avgMastery: 72 },
          { id: 'b2', name: 'NEET Droppers', studentCount: 85, avgMastery: 65 }
        ];
      } else if (url.includes('/students')) {
        mockData = { data: [{ id: 's1', user: { name: 'Aarav Sharma', email: 'aarav@demo.com', status: 'ACTIVE' }, batch: { name: 'JEE Target 2026' }, rollNumber: '2026-001' }] };
      } else if (url.includes('/teachers')) {
        mockData = { data: [{ id: 't1', user: { name: 'Dr. Verma', email: 'verma@demo.com', status: 'ACTIVE' }, subjects: [{ subject: { name: 'Physics' } }] }] };
      } else if (url.includes('/blueprints')) {
        mockData = [];
      } else if (url.includes('/timetable')) {
        mockData = [];
      } else if (url.includes('/institutes') && !url.includes('/students') && !url.includes('/teachers') && !url.includes('/batches') && !url.includes('/analytics') && !url.includes('/timetable') && !url.includes('/exams')) {
        // Assume /institutes list or details
        mockData = [{ id: 'demo-inst-1', name: 'Demo Institute', type: 'COACHING' }];
      } else if (url.includes('/subjects')) {
        mockData = [{ id: 'sub1', name: 'Physics', code: 'PHY101' }, { id: 'sub2', name: 'Chemistry', code: 'CHE101' }];
      } else if (url.includes('/questions')) {
        mockData = { data: [] };
      }
      return Promise.resolve({ data: mockData, status: 200 });
    }

    return retryAfterRefresh(error, apiClient);
  },
);

/**
 * Axios instance for the Python AI Engine.
 *
 * Same-origin and proxied, exactly like `apiClient` above. This was previously
 * `baseURL: 'http://localhost:8000'` — a literal address of *the browser's own
 * machine*, so every screen built on it (the batch heatmaps, AI blueprint
 * generation, the evaluation-quality dashboard) worked only on a developer
 * laptop running the engine locally and failed for every real user. `/api/py`
 * is served by a route handler (app/api/py/[...path]) that reads PYTHON_API_URL
 * per request — not a next.config.js rewrite, which would freeze it at build time.
 */
export const aiClient = axios.create({
  baseURL: '/api/py',
  headers: { 'Content-Type': 'application/json' },
});

if (isDemoMode) {
  aiClient.interceptors.request.use((config) => {
    return Promise.reject({ __isMock: true, config });
  });
}

aiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const err = error as Record<string, unknown>;
    if (err['__isMock']) {
      const config = err['config'] as { url?: string };
      const url = config.url || '';
      let mockData: unknown = { data: [] };
      
      if (url.includes('/heatmap')) {
        mockData = {
          success: true,
          data: [
            { topicId: 't1', topicName: 'Kinematics', averageMastery: 35.5, studentsStruggling: 45, totalStudents: 120, strugglePercentage: 37.5, status: 'CRITICAL' },
            { topicId: 't2', topicName: 'Optics', averageMastery: 62.0, studentsStruggling: 20, totalStudents: 120, strugglePercentage: 16.6, status: 'WARNING' },
            { topicId: 't3', topicName: 'Thermodynamics', averageMastery: 85.0, studentsStruggling: 5, totalStudents: 120, strugglePercentage: 4.1, status: 'HEALTHY' }
          ]
        };
      } else if (url.includes('/generate-blueprint')) {
        mockData = {
          success: true,
          data: {
            title: "AI Generated Mock Test",
            duration: 90,
            rules: [
              { topicName: "Kinematics", questionType: "MCQ", difficulty: "HARD", count: 10 },
              { topicName: "Optics", questionType: "NUMERICAL", difficulty: "MEDIUM", count: 5 }
            ]
          }
        };
      }
      return Promise.resolve({ data: mockData, status: 200 });
    }
    return retryAfterRefresh(error, aiClient);
  }
);

aiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aios_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
