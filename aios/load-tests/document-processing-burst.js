// docs/20-IMPLEMENTATION-PLAN.md Phase 15 / docs/10-SCALABILITY-STRATEGY.md V2
// addendum targets: "10,000 scanned pages processed per day at peak (school
// exam season)" and "500 concurrent identity-resolution manual-review
// actions." Two scenarios in one script since both sit on the same v2
// document pipeline and the doc names them together under "exam-week burst."
//
// UNEXECUTED — see load-tests/README.md. Needs a real BUNDLE_ID (an existing
// DocumentBundle for a PHOTO_CAPTURE_SUBJECTIVE delivery) and a comma-
// separated RESOLUTION_IDS list of real PENDING IdentityResolution rows with
// a matching STUDENT_PROFILE_ID in the delivery's batch — this pipeline has
// no auto-detection wired (30-IDENTITY-PAGE-MAPPING.md, Phase 10/33), so
// every resolution here is the MANUAL_ADMIN_MATCH path, same as production.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const INSTITUTE_ID = __ENV.INSTITUTE_ID;
const BUNDLE_ID = __ENV.BUNDLE_ID || 'PLACEHOLDER_BUNDLE_ID';
const STUDENT_PROFILE_ID = __ENV.STUDENT_PROFILE_ID || 'PLACEHOLDER_STUDENT_PROFILE_ID';
const RESOLUTION_IDS = (__ENV.RESOLUTION_IDS || '').split(',').filter(Boolean);

const uploadLatency = new Trend('page_upload_latency', true);
const confirmLatency = new Trend('identity_confirm_latency', true);

// 10,000 pages/day at peak, spread across an exam-week's active hours rather
// than uniformly — approximated here as a sustained rate over the scenario's
// duration; a real run should tune `rate`/`duration` to the target school's
// actual peak-hour window rather than a flat 24h average.
export const options = {
  scenarios: {
    page_upload_burst: {
      executor: 'constant-arrival-rate',
      rate: 20, // ~10,000 pages / 8 exam-week peak hours ≈ 20-25/min sustained; rounded up for burst headroom
      timeUnit: '1m',
      duration: '10m',
      preAllocatedVUs: 20,
      maxVUs: 60,
      exec: 'uploadPage',
    },
    identity_resolution_burst: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 500, // 10-SCALABILITY-STRATEGY.md V2 addendum: 500 concurrent manual-review actions
      maxDuration: '3m',
      exec: 'confirmIdentity',
    },
  },
  thresholds: {
    page_upload_latency: ['p(95)<2000'], // page upload + PATH_A/B stage enqueue, not the full pipeline
    identity_confirm_latency: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export function uploadPage() {
  const payload = {
    files: http.file(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), `page-${__VU}-${__ITER}.jpg`, 'image/jpeg'),
  };

  const res = http.post(
    `${BASE_URL}/institutes/${INSTITUTE_ID}/document-bundles/${BUNDLE_ID}/documents`,
    payload,
    { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }, // multipart boundary set automatically by k6
  );

  uploadLatency.add(res.timings.duration);

  check(res, {
    // 202 Accepted (pipeline processing continues async) or 409 (idempotency
    // replay); never a 5xx from upload/enqueue back-pressure.
    'status is 202/409, never a 5xx': (r) => [202, 409].includes(r.status),
  });
}

export function confirmIdentity() {
  const resolutionId = RESOLUTION_IDS.length
    ? RESOLUTION_IDS[Math.floor(Math.random() * RESOLUTION_IDS.length)]
    : 'PLACEHOLDER_RESOLUTION_ID';

  const payload = JSON.stringify({ studentProfileId: STUDENT_PROFILE_ID });
  const res = http.post(
    `${BASE_URL}/institutes/${INSTITUTE_ID}/identity-resolutions/${resolutionId}/confirm`,
    payload,
    { headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' } },
  );

  confirmLatency.add(res.timings.duration);

  check(res, {
    // 200 = confirmed; 409 = already-resolved or a genuine IDENTITY_RESOLUTION_CONFLICT
    // (30 §5 — expected under concurrent review of overlapping candidates, not a bug).
    'status is 200/409, never a 5xx': (r) => [200, 409].includes(r.status),
  });
}
