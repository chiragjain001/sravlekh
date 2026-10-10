/**
 * High-VU Stress & Soak Test for AIOS API
 * =========================================
 * Phases:
 *   1. Ramp-up:  0  to 50  VUs over 30s
 *   2. Stress:   50 to 200 VUs over 60s
 *   3. Peak:     200 VUs sustained for 60s
 *   4. Ramp-down: 200 to 0 VUs over 30s
 *
 * Usage:
 *   k6 run load-tests/stress-test-highvu.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const INSTITUTE_ID = __ENV.INSTITUTE_ID || 'demo-institute-1';

const authLatency      = new Trend('stress_auth_ms', true);
const meLatency        = new Trend('stress_me_ms', true);
const questionsLatency = new Trend('stress_questions_ms', true);
const batchesLatency   = new Trend('stress_batches_ms', true);
const errorRate        = new Rate('stress_error_rate');
const rateLimited      = new Counter('stress_rate_limited');
const serverErrors     = new Counter('stress_5xx_errors');

export const options = {
  scenarios: {
    stress_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 50  },
        { duration: '60s', target: 200 },
        { duration: '60s', target: 200 },
        { duration: '30s', target: 0   },
      ],
    },
  },
  thresholds: {
    stress_auth_ms:      ['p(95)<2000'],
    stress_me_ms:        ['p(95)<1000'],
    stress_questions_ms: ['p(95)<1000'],
    stress_error_rate:   ['rate<0.05'],
    http_req_failed:     ['rate<0.05'],
  },
};

export default function () {
  const authPayload = JSON.stringify({ role: 'TEACHER' });
  const authRes = http.post(BASE_URL + '/auth/dev-login', authPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  authLatency.add(authRes.timings.duration);

  if (authRes.status === 429) { rateLimited.add(1); errorRate.add(0); sleep(1); return; }
  if (authRes.status !== 200) { serverErrors.add(1); errorRate.add(1); sleep(0.5); return; }
  errorRate.add(0);

  const token = authRes.json('accessToken');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  const meRes = http.get(BASE_URL + '/auth/me', { headers });
  meLatency.add(meRes.timings.duration);
  if (!check(meRes, { 'me: 200': (r) => r.status === 200 })) errorRate.add(1);

  const qRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/questions', { headers });
  questionsLatency.add(qRes.timings.duration);
  if (!check(qRes, { 'questions: 200': (r) => r.status === 200 })) errorRate.add(1);

  const bRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/batches', { headers });
  batchesLatency.add(bRes.timings.duration);
  if (bRes.status === 429) rateLimited.add(1);
  else if (bRes.status >= 500) { serverErrors.add(1); errorRate.add(1); }

  sleep(0.3);
}
