import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.WEB_URL || 'http://localhost:3000';
const loginDuration = new Trend('frontend_login_duration', true);
const staticAssetDuration = new Trend('frontend_static_duration', true);
const requestCounter = new Counter('frontend_total_requests');

export const options = {
  scenarios: {
    frontend_stress: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '5s', target: 25 },
        { duration: '10s', target: 50 },
        { duration: '10s', target: 100 },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    frontend_login_duration: ['p(95)<250'],
    frontend_static_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Test Next.js rendered HTML page
  const loginRes = http.get(`${BASE_URL}/login`);
  loginDuration.add(loginRes.timings.duration);
  requestCounter.add(1);
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has HTML': (r) => r.body && r.body.length > 500,
  });

  // Test PWA / Static assets
  const manifestRes = http.get(`${BASE_URL}/manifest.json`);
  staticAssetDuration.add(manifestRes.timings.duration);
  requestCounter.add(1);
  check(manifestRes, {
    'manifest status 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
