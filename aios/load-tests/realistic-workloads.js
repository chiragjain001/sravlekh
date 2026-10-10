/**
 * AIOS Realistic Multi-Role Workload & Capacity Test
 * ==================================================
 * Simulates real user behavior across:
 *   1. Teacher (40% traffic): Dashboard -> Batches -> Questions search -> Evaluation Queue -> Question creation
 *   2. Admin (30% traffic):   Dashboard stats -> Students management -> Teachers stats -> Audit logs
 *   3. Student (30% traffic): Student profile -> Exams -> Assignments -> Notices -> Timetable
 *
 * Concurrency Stages:
 *   - 25 VUs for 20s
 *   - 50 VUs for 20s
 *   - 100 VUs for 20s
 *   - 150 VUs for 20s
 *   - 200 VUs for 20s
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const INSTITUTE_ID = __ENV.INSTITUTE_ID || 'demo-institute-1';

// Metrics per role
const teacherLatency = new Trend('role_teacher_latency_ms', true);
const adminLatency   = new Trend('role_admin_latency_ms', true);
const studentLatency = new Trend('role_student_latency_ms', true);
const writeLatency   = new Trend('write_question_latency_ms', true);

const roleErrors     = new Rate('realistic_error_rate');
const rateLimited    = new Counter('realistic_rate_limited');
const server5xx      = new Counter('realistic_5xx');

export const options = {
  scenarios: {
    progressive_capacity: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 25 },
        { duration: '20s', target: 25 },
        { duration: '15s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '15s', target: 100 },
        { duration: '20s', target: 100 },
        { duration: '15s', target: 150 },
        { duration: '20s', target: 150 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    realistic_error_rate: ['rate<0.05'],
    http_req_failed:      ['rate<0.05'],
  },
};

// Cached tokens to simulate logged-in user sessions rather than hammering login endpoint every request
let teacherToken = null;
let adminToken   = null;
let studentToken = null;

function getToken(role) {
  const res = http.post(BASE_URL + '/auth/dev-login', JSON.stringify({ role }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 200) {
    return res.json('accessToken');
  }
  return null;
}

export function setup() {
  const t = getToken('TEACHER');
  const a = getToken('ADMIN');
  const s = getToken('STUDENT');
  return { teacherToken: t, adminToken: a, studentToken: s };
}

export default function (data) {
  const rand = Math.random();

  // 1. TEACHER FLOW (40%)
  if (rand < 0.40) {
    const token = data.teacherToken;
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    const t0 = Date.now();
    // 1. Dashboard & Me
    const meRes = http.get(BASE_URL + '/auth/me', { headers });
    // 2. Batches
    const batchRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/batches', { headers });
    // 3. Questions search
    const qRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/questions?page=1&limit=20', { headers });
    // 4. Evaluation work items
    const evalRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/evaluation-work-items?pageSize=5', { headers });

    const dur = Date.now() - t0;
    teacherLatency.add(dur);

    const ok = meRes.status === 200 && batchRes.status === 200 && qRes.status === 200;
    roleErrors.add(ok ? 0 : 1);
    if (batchRes.status === 429 || qRes.status === 429) rateLimited.add(1);
    if (batchRes.status >= 500 || qRes.status >= 500) server5xx.add(1);

    // 5% of teacher actions create a question (realistic write operation)
    if (Math.random() < 0.05) {
      const wt0 = Date.now();
      const writeRes = http.post(
        BASE_URL + '/institutes/' + INSTITUTE_ID + '/questions',
        JSON.stringify({
          type: 'MCQ',
          difficulty: 'MEDIUM',
          marks: 4,
          negativeMarks: 1,
          content: 'Sample test question created during capacity load test ' + Date.now(),
          subjectId: 'demo-subject-physics',
          chapterId: 'demo-chapter-1',
          topicId: 'demo-topic-1',
          options: [
            { label: 'A', text: 'Option 1', isCorrect: true },
            { label: 'B', text: 'Option 2', isCorrect: false }
          ]
        }),
        { headers }
      );
      writeLatency.add(Date.now() - wt0);
    }
  }

  // 2. ADMIN FLOW (30%)
  else if (rand < 0.70) {
    const token = data.adminToken;
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    const t0 = Date.now();
    // 1. Admin stats
    const stRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/students/stats', { headers });
    const tcRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/teachers/stats', { headers });
    // 2. Students list
    const stuRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/students?sortBy=name&sortDir=asc&page=1&limit=10', { headers });
    // 3. Audit logs
    const auditRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/audit-logs?pageSize=6', { headers });

    const dur = Date.now() - t0;
    adminLatency.add(dur);

    const ok = stRes.status === 200 && stuRes.status === 200;
    roleErrors.add(ok ? 0 : 1);
    if (stuRes.status === 429) rateLimited.add(1);
    if (stuRes.status >= 500) server5xx.add(1);
  }

  // 3. STUDENT FLOW (30%)
  else {
    const token = data.studentToken;
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    const t0 = Date.now();
    // 1. Student profile
    const meRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/students/me', { headers });
    // 2. Exams
    const examRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/exams', { headers });
    // 3. Notices
    const notRes = http.get(BASE_URL + '/institutes/' + INSTITUTE_ID + '/notices/mine', { headers });

    const dur = Date.now() - t0;
    studentLatency.add(dur);

    const ok = examRes.status === 200 && notRes.status === 200;
    roleErrors.add(ok ? 0 : 1);
    if (examRes.status === 429) rateLimited.add(1);
    if (examRes.status >= 500) server5xx.add(1);
  }

  sleep(0.5); // 500ms think time between simulated user actions
}
