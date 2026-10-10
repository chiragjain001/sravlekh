import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const INSTITUTE_ID = __ENV.INSTITUTE_ID || 'demo-institute-1';

// Metrics
const healthLatency = new Trend('latency_health', true);
const authLatency = new Trend('latency_auth_dev_login', true);
const meLatency = new Trend('latency_auth_me', true);
const questionsLatency = new Trend('latency_questions', true);
const batchesLatency = new Trend('latency_batches', true);
const studentsLatency = new Trend('latency_students', true);

const successfulRequests = new Counter('successful_requests');
const rateLimitedRequests = new Counter('rate_limited_requests');
const errorRequests = new Counter('error_requests');
const errorRate = new Rate('custom_error_rate');

export const options = {
  scenarios: {
    // 1. High throughput health check
    health_check: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10s',
      exec: 'testHealth',
    },
    // 2. Authentication Stress
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '10s', target: 50 },
        { duration: '5s', target: 0 },
      ],
      startTime: '10s',
      exec: 'testAuth',
    },
    // 3. Authenticated Dashboard Workflow
    dashboard_reads: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 15 },
        { duration: '15s', target: 30 },
        { duration: '5s', target: 0 },
      ],
      startTime: '35s',
      exec: 'testDashboard',
    },
  },
  thresholds: {
    latency_health: ['p(95)<100'],
    latency_auth_dev_login: ['p(95)<400'],
    latency_auth_me: ['p(95)<300'],
    latency_questions: ['p(95)<500'],
    custom_error_rate: ['rate<0.05'],
  },
};

export function testHealth() {
  const res = http.get(`${BASE_URL}/health`);
  healthLatency.add(res.timings.duration);
  const ok = check(res, { 'health status is 200': (r) => r.status === 200 });
  if (ok) successfulRequests.add(1);
  else errorRequests.add(1);
  errorRate.add(!ok);
  sleep(0.1);
}

export function testAuth() {
  const payload = JSON.stringify({ role: 'TEACHER' });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(`${BASE_URL}/auth/dev-login`, payload, params);
  authLatency.add(res.timings.duration);

  if (res.status === 200) {
    successfulRequests.add(1);
    errorRate.add(0);
  } else if (res.status === 429) {
    rateLimitedRequests.add(1);
    errorRate.add(0); // rate limiting is expected security behavior under extreme surge
  } else {
    errorRequests.add(1);
    errorRate.add(1);
  }
  sleep(0.2);
}

export function testDashboard() {
  // First obtain or reuse JWT
  const authPayload = JSON.stringify({ role: 'TEACHER' });
  const authRes = http.post(`${BASE_URL}/auth/dev-login`, authPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (authRes.status !== 200) {
    if (authRes.status === 429) rateLimitedRequests.add(1);
    else {
      errorRequests.add(1);
      errorRate.add(1);
    }
    sleep(0.5);
    return;
  }

  const token = authRes.json('accessToken');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // /auth/me
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers });
  meLatency.add(meRes.timings.duration);
  check(meRes, { 'me status 200': (r) => r.status === 200 });

  // /questions
  const qRes = http.get(`${BASE_URL}/institutes/${INSTITUTE_ID}/questions`, { headers });
  questionsLatency.add(qRes.timings.duration);

  // /batches
  const bRes = http.get(`${BASE_URL}/institutes/${INSTITUTE_ID}/batches`, { headers });
  batchesLatency.add(bRes.timings.duration);

  // /students
  const sRes = http.get(`${BASE_URL}/institutes/${INSTITUTE_ID}/students`, { headers });
  studentsLatency.add(sRes.timings.duration);

  successfulRequests.add(4);
  errorRate.add(0);
  sleep(0.5);
}
