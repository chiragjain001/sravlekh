// 13-TESTING-STRATEGY.md §8, scenario 1: "100 concurrent MANUAL_GRID/CSV grading
// submissions/second sustained for 10 minutes; assert p95 write latency stays
// < 300ms and no data loss/duplication occurs."
//
// UNEXECUTED — see load-tests/README.md. Needs a real ANSWER_SHEET_ID seeded
// against a real ONGOING/EVALUATING exam before this can run meaningfully.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;
const INSTITUTE_ID = __ENV.INSTITUTE_ID;
const ANSWER_SHEET_ID = __ENV.ANSWER_SHEET_ID; // must belong to an ONGOING/EVALUATING exam

const gradeWriteLatency = new Trend('grade_write_latency', true);

export const options = {
  scenarios: {
    grading_burst: {
      executor: 'constant-arrival-rate',
      rate: 100,          // 100 iterations/sec == 100 grading submissions/sec
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 150,
      maxVUs: 300,
    },
  },
  thresholds: {
    // 11-PERFORMANCE-REQUIREMENTS.md / 13-TESTING-STRATEGY.md §8: p95 < 300ms.
    grade_write_latency: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    responses: [
      { questionId: 'PLACEHOLDER_QUESTION_ID', marksAwarded: 4, isCorrect: true },
    ],
  });

  const res = http.post(
    `${BASE_URL}/institutes/${INSTITUTE_ID}/exams/answer-sheets/${ANSWER_SHEET_ID}/grade`,
    payload,
    { headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' } },
  );

  gradeWriteLatency.add(res.timings.duration);

  check(res, {
    'status is 200/201/409 (409 = expected duplicate-submission rejection, not data loss)': (r) =>
      [200, 201, 409].includes(r.status),
  });
}
