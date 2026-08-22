// docs/20-IMPLEMENTATION-PLAN.md Phase 15 / docs/10-SCALABILITY-STRATEGY.md V2
// addendum target: "2,000 concurrent AI evaluation jobs (batched, not
// per-request)". Simulates the real v2 trigger mechanism (27-AI-EVALUATION-
// ARCHITECTURE.md / 25-EVALUATION-ENGINE.md §4.1): a delivery entering
// EVALUATING auto-enqueues one ai-evaluation BATCH job covering every
// subjective Response under it — this script fires that transition
// concurrently across many deliveries (an exam-week burst is many schools'
// deliveries crossing into EVALUATING around the same time), not 2,000
// individual per-response HTTP calls, matching the target's own "batched, not
// per-request" framing.
//
// UNEXECUTED — see load-tests/README.md. Needs DELIVERY_IDS seeded as a
// comma-separated list of real ONGOING AssessmentDelivery ids, each with
// subjective Responses already submitted (so the transition is legal and the
// resulting batch job has real work to do).
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const INSTITUTE_ID = __ENV.INSTITUTE_ID;
const DELIVERY_IDS = (__ENV.DELIVERY_IDS || '').split(',').filter(Boolean); // 'PLACEHOLDER_DELIVERY_ID' if unset

const triggerLatency = new Trend('evaluating_transition_latency', true);

export const options = {
  scenarios: {
    ai_evaluation_burst: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 2000, // 10-SCALABILITY-STRATEGY.md V2 addendum: 2,000 concurrent AI evaluation jobs
      maxDuration: '5m',
    },
  },
  thresholds: {
    // The transition call itself must stay fast — it only enqueues a batch
    // job, per 25 §4.1's "system-triggered, async, never blocking this
    // status-transition response." The actual AI evaluation work happens off
    // the request path in apps/api-python.
    evaluating_transition_latency: ['p(95)<500'],
    http_req_failed: ['rate<0.05'], // some 409s expected — a delivery can only enter EVALUATING once
  },
};

export default function () {
  const deliveryId = DELIVERY_IDS.length
    ? DELIVERY_IDS[Math.floor(Math.random() * DELIVERY_IDS.length)]
    : 'PLACEHOLDER_DELIVERY_ID';

  const payload = JSON.stringify({ status: 'EVALUATING', version: 0 });
  const res = http.patch(
    `${BASE_URL}/institutes/${INSTITUTE_ID}/assessment-deliveries/${deliveryId}/status`,
    payload,
    { headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' } },
  );

  triggerLatency.add(res.timings.duration);

  check(res, {
    // 200/201 = this VU won the transition; 409 = STALE_VERSION or already-
    // EVALUATING (expected — many VUs racing the same small pool of seeded
    // deliveries), never a 5xx from queue back-pressure.
    'status is 200/201/409, never a 5xx (queue never back-pressures the HTTP layer)': (r) =>
      [200, 201, 409].includes(r.status),
  });
}
