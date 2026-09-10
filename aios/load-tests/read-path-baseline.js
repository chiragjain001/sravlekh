// Baseline latency for the authenticated READ paths every dashboard hits.
//
// WHY THIS SCRIPT EXISTS ALONGSIDE THE OTHERS. The five domain scripts in this
// directory (grading, blueprint, report, ai-evaluation, document-processing) each
// need seeded state that does not exist in a fresh database — a real
// ANSWER_SHEET_ID on an ONGOING exam, real DELIVERY_IDS with subjective
// Responses already submitted. Running them without that produces 404s at speed,
// which is a measurement of nothing.
//
// This one needs only what `packages/db/src/seed.ts` already creates, so it is
// the first script in this directory that can actually be RUN, and therefore the
// first real numbers this repo has. It measures the request path every screen
// depends on: JWT verification, tenant scoping, and a Prisma read.
//
//   BASE_URL=http://localhost:4444/api/v1 AUTH_TOKEN=<jwt> INSTITUTE_ID=<id> \
//     k6 run load-tests/read-path-baseline.js
//
// Thresholds come from 11-PERFORMANCE-REQUIREMENTS.md's p95 < 300ms for reads.
import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const INSTITUTE_ID = __ENV.INSTITUTE_ID;
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '30s';

// Separate trends per endpoint: one aggregate number would hide that the
// question bank (the largest table here) behaves differently from a batch list.
const questionsLatency = new Trend('read_questions', true);
const batchesLatency = new Trend('read_batches', true);
const studentsLatency = new Trend('read_students', true);
const meLatency = new Trend('read_auth_me', true);

export const options = {
  scenarios: {
    read_path: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    // 11-PERFORMANCE-REQUIREMENTS.md: p95 < 300ms for authenticated reads.
    read_questions: ['p(95)<300'],
    read_batches: ['p(95)<300'],
    read_students: ['p(95)<300'],
    // /auth/me is JWT verification plus one user lookup — the cheapest
    // authenticated request in the system, and therefore the floor that every
    // other endpoint's latency is measured against.
    read_auth_me: ['p(95)<150'],
    http_req_failed: ['rate<0.01'],
  },
};

const headers = { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' };

export default function () {
  group('reads', () => {
    const me = http.get(`${BASE_URL}/auth/me`, { headers });
    meLatency.add(me.timings.duration);
    check(me, { 'auth/me 200': (r) => r.status === 200 });

    const questions = http.get(`${BASE_URL}/institutes/${INSTITUTE_ID}/questions`, { headers });
    questionsLatency.add(questions.timings.duration);
    check(questions, { 'questions 200': (r) => r.status === 200 });

    const batches = http.get(`${BASE_URL}/institutes/${INSTITUTE_ID}/batches`, { headers });
    batchesLatency.add(batches.timings.duration);
    check(batches, { 'batches 200': (r) => r.status === 200 });

    const students = http.get(`${BASE_URL}/institutes/${INSTITUTE_ID}/students`, { headers });
    studentsLatency.add(students.timings.duration);
    check(students, { 'students 200': (r) => r.status === 200 });
  });
}
