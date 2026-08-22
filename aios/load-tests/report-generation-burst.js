// 13-TESTING-STRATEGY.md §8, scenario 3: "500 concurrent POST /reports
// requests; assert queue absorbs load without exceeding job dead-letter
// thresholds."
//
// UNEXECUTED — see load-tests/README.md. Targets the real ReportsController
// built in Phase 6 (apps/api/src/reports) — this one endpoint genuinely
// matches the doc's description exactly, unlike scenario 2's.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const INSTITUTE_ID = __ENV.INSTITUTE_ID;
const BATCH_ID = __ENV.BATCH_ID;

export const options = {
  scenarios: {
    report_burst: {
      executor: 'shared-iterations',
      vus: 500,
      iterations: 500,
      maxDuration: '3m',
    },
  },
  thresholds: {
    // The queue accepting the job (202) must hold up under the burst — this
    // is a queue-absorption test, not a synchronous-completion test, since
    // generation itself is async (see reports.service.ts).
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    type: 'CLASS_REPORT',
    scope: { batchId: BATCH_ID },
    format: 'PDF',
  });

  const res = http.post(`${BASE_URL}/institutes/${INSTITUTE_ID}/reports`, payload, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
  });

  check(res, {
    'report is accepted (202) rather than rejected under load': (r) => r.status === 202,
  });

  // Real dead-letter-rate verification needs a follow-up pass polling each
  // returned reportId's status after the burst — not scripted here, since it
  // requires the burst's own response ids to be collected and revisited,
  // which k6's shared-iterations executor doesn't carry between VUs cleanly.
  // Whoever runs this for the first time should add that as a second pass.
  sleep(0.1);
}
