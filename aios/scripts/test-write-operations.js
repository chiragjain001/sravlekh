const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:4000/api/v1';

async function makeRequest(path, method, token, body) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const dur = performance.now() - t0;
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, duration: dur, data: json });
      });
    });

    req.on('error', err => resolve({ status: 500, duration: performance.now() - t0, error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('AIOS WRITE-HEAVY OPERATIONS & CONCURRENCY BENCHMARK');
  console.log('====================================================\n');

  // Authenticate as ADMIN and TEACHER
  const adminRes = await makeRequest('/auth/dev-login', 'POST', null, { role: 'ADMIN' });
  const teacherRes = await makeRequest('/auth/dev-login', 'POST', null, { role: 'TEACHER' });
  const adminToken = adminRes.data.accessToken;
  const teacherToken = teacherRes.data.accessToken;

  // 1. Single Write Baseline: Batch Creation & Update
  console.log('--- 1. Baseline Write: Batch Creation & Update ---');
  const b0 = await makeRequest('/institutes/demo-institute-1/batches', 'POST', adminToken, {
    name: 'Write Benchmark Batch ' + Date.now(),
    classYear: '11th',
    section: 'W',
    academicYear: '2026-27'
  });
  console.log(`  Batch Create: Status ${b0.status} in ${b0.duration.toFixed(2)} ms`);
  const batchId = b0.data?.id;

  if (batchId) {
    const bUpdate = await makeRequest(`/institutes/demo-institute-1/batches/${batchId}`, 'PATCH', adminToken, {
      name: 'Write Benchmark Batch (Updated)'
    });
    console.log(`  Batch Update: Status ${bUpdate.status} in ${bUpdate.duration.toFixed(2)} ms`);
  }

  // 2. Concurrent Question Creations (15 concurrent writes)
  console.log('\n--- 2. Concurrent Write Load: 15 Concurrent Question Creations ---');
  const qTasks = Array.from({ length: 15 }).map((_, i) => {
    return makeRequest('/institutes/demo-institute-1/questions', 'POST', teacherToken, {
      type: 'MCQ',
      difficulty: 'MEDIUM',
      marks: 4,
      negativeMarks: 1,
      content: `Concurrent Benchmark Question #${i + 1} (${Date.now()})`,
      subjectId: 'demo2-subject-chemistry',
      chapterId: 'demo2-chapter-chem-bonding',
      topicId: 'demo2-topic-chem-ionic-covalent',
      options: [
        { label: 'A', text: 'Option Alpha', isCorrect: true },
        { label: 'B', text: 'Option Beta', isCorrect: false }
      ]
    });
  });

  const tStartWrites = performance.now();
  const qResults = await Promise.all(qTasks);
  const totalWriteTime = performance.now() - tStartWrites;

  const qDurations = qResults.map(r => r.duration).sort((a, b) => a - b);
  const qSuccess = qResults.filter(r => r.status === 201).length;
  const p50 = qDurations[Math.floor(qDurations.length * 0.5)];
  const p95 = qDurations[Math.floor(qDurations.length * 0.95)];
  const max = qDurations[qDurations.length - 1];

  console.log(`  Completed 15 concurrent writes in: ${totalWriteTime.toFixed(2)} ms`);
  console.log(`  Success Rate:                      ${qSuccess} / 15 (${((qSuccess / 15) * 100).toFixed(0)}%)`);
  console.log(`  Write Throughput:                  ${(15 / (totalWriteTime / 1000)).toFixed(1)} writes/sec`);
  console.log(`  p50 Write Latency:                 ${p50.toFixed(2)} ms`);
  console.log(`  p95 Write Latency:                 ${p95.toFixed(2)} ms`);
  console.log(`  Max Write Latency:                 ${max.toFixed(2)} ms`);

  // 3. Attendance Recording
  console.log('\n--- 3. Attendance Submission Write ---');
  const attRes = await makeRequest('/institutes/demo-institute-1/attendance', 'POST', teacherToken, {
    batchId: 'school-batch-c10-a',
    date: new Date().toISOString().split('T')[0],
    records: [
      { studentProfileId: 'cmtu1avpc002l95psn98mnqwb', status: 'PRESENT' }
    ]
  });
  console.log(`  Attendance Submission: Status ${attRes.status} in ${attRes.duration.toFixed(2)} ms`);

  console.log('\n====================================================');
  console.log('WRITE BENCHMARK COMPLETE');
  console.log('====================================================');
}

run().catch(console.error);
