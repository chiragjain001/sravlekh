const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:4000/api/v1';

async function makeRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', err => resolve({ status: 500, error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('AIOS MULTI-TENANT ISOLATION VALIDATION');
  console.log('====================================================\n');

  // Step 1: Ensure demo-institute-2 exists in DB
  console.log('Step 1: Setting up isolated secondary tenant (demo-institute-2)...');
  let inst2 = await prisma.institute.findUnique({ where: { id: 'demo-institute-2' } });
  if (!inst2) {
    inst2 = await prisma.institute.create({
      data: {
        id: 'demo-institute-2',
        name: 'Zenith Global Institute (Tenant 2)',
        plan: 'PRO',
        status: 'ACTIVE',
        domainAllowlist: ['zenith.edu']
      }
    });
    console.log('  Created secondary tenant:', inst2.name);
  } else {
    console.log('  Secondary tenant already exists:', inst2.name);
  }

  // Ensure a batch exists in Tenant 2
  let batch2 = await prisma.batch.findFirst({ where: { instituteId: 'demo-institute-2' } });
  if (!batch2) {
    batch2 = await prisma.batch.create({
      data: {
        id: 'zenith-batch-1',
        instituteId: 'demo-institute-2',
        name: 'Zenith Batch 2026-A',
        classYear: '12th',
        section: 'A',
        academicYear: '2026-27'
      }
    });
    console.log('  Created Tenant 2 batch:', batch2.name);
  }

  // Ensure a question exists in Tenant 2
  let question2 = await prisma.question.findFirst({ where: { instituteId: 'demo-institute-2' } });
  if (!question2) {
    // Need a subject in Tenant 2
    let sub2 = await prisma.subject.findFirst({ where: { instituteId: 'demo-institute-2' } });
    if (!sub2) {
      sub2 = await prisma.subject.create({
        data: {
          instituteId: 'demo-institute-2',
          name: 'Zenith Advanced Mathematics',
          code: 'Z-MATH'
        }
      });
      const chap2 = await prisma.chapter.create({
        data: { subjectId: sub2.id, name: 'Calculus IV', order: 1 }
      });
      const top2 = await prisma.topic.create({
        data: { chapterId: chap2.id, name: 'Multivariable Integration', order: 1 }
      });
      question2 = await prisma.question.create({
        data: {
          instituteId: 'demo-institute-2',
          subjectId: sub2.id,
          chapterId: chap2.id,
          topicId: top2.id,
          type: 'MCQ',
          difficulty: 'HARD',
          marks: 4,
          content: 'SECRET_TENANT_2_QUESTION: What is the volume under z = x^2 + y^2?',
          createdByUserId: 'cmt666k2j000b145zdsklngtv'
        }
      });
    }
  }

  // Step 2: Login as Teacher for Tenant 1 (demo-institute-1)
  console.log('\nStep 2: Authenticating as Teacher in Tenant 1 (demo-institute-1)...');
  const loginRes = await makeRequest('/auth/dev-login', 'POST', null, { role: 'TEACHER' });
  if (loginRes.status !== 200 || !loginRes.data.accessToken) {
    console.error('  Failed to authenticate:', loginRes);
    return;
  }
  const token1 = loginRes.data.accessToken;
  console.log('  Obtained JWT for Tenant 1 actor.');

  // Test 2.1: Tenant 1 actor attempts to read Tenant 2 batches
  console.log('\n--- Test 2.1: Cross-Tenant Batches Access ---');
  const batchCrossRes = await makeRequest('/institutes/demo-institute-2/batches', 'GET', token1);
  console.log(`  GET /institutes/demo-institute-2/batches -> Status: ${batchCrossRes.status}`);
  if (batchCrossRes.status === 403 || batchCrossRes.status === 404) {
    console.log('  [PASS] Tenant boundary enforced: Cross-tenant batch query rejected with HTTP', batchCrossRes.status);
  } else {
    console.error('  [FAIL] Tenant isolation breach! Received:', batchCrossRes.status, batchCrossRes.data);
  }

  // Test 2.2: Tenant 1 actor attempts to read Tenant 2 question bank
  console.log('\n--- Test 2.2: Cross-Tenant Question Bank Access ---');
  const qCrossRes = await makeRequest('/institutes/demo-institute-2/questions', 'GET', token1);
  console.log(`  GET /institutes/demo-institute-2/questions -> Status: ${qCrossRes.status}`);
  if (qCrossRes.status === 403 || qCrossRes.status === 404) {
    console.log('  [PASS] Tenant boundary enforced: Cross-tenant question bank access rejected with HTTP', qCrossRes.status);
  } else {
    console.error('  [FAIL] Tenant isolation breach! Received:', qCrossRes.status, qCrossRes.data);
  }

  // Test 2.3: Tenant 1 questions search leak check
  console.log('\n--- Test 2.3: Question Bank Search Data Leakage Check ---');
  const qSearchRes = await makeRequest('/institutes/demo-institute-1/questions?search=SECRET_TENANT_2_QUESTION', 'GET', token1);
  console.log(`  GET /institutes/demo-institute-1/questions?search=SECRET_TENANT_2_QUESTION -> Status: ${qSearchRes.status}`);
  const items = Array.isArray(qSearchRes.data?.data) ? qSearchRes.data.data : Array.isArray(qSearchRes.data) ? qSearchRes.data : [];
  const leaked = items.some(q => q.content && q.content.includes('SECRET_TENANT_2_QUESTION'));
  if (!leaked && items.length === 0) {
    console.log('  [PASS] Search isolation confirmed: Tenant 2 secret question is NOT visible in Tenant 1 search results.');
  } else {
    console.error('  [FAIL] Question bank data leakage detected! Leaked question returned to Tenant 1.');
  }

  // Test 2.4: Cross-Tenant Student Data Access
  console.log('\n--- Test 2.4: Cross-Tenant Student Profile Access ---');
  const stuCrossRes = await makeRequest('/institutes/demo-institute-2/students', 'GET', token1);
  console.log(`  GET /institutes/demo-institute-2/students -> Status: ${stuCrossRes.status}`);
  if (stuCrossRes.status === 403 || stuCrossRes.status === 404) {
    console.log('  [PASS] Tenant boundary enforced: Cross-tenant student access rejected with HTTP', stuCrossRes.status);
  } else {
    console.error('  [FAIL] Tenant isolation breach! Received:', stuCrossRes.status);
  }

  // Test 2.5: Cross-Tenant Audit Logs Access
  console.log('\n--- Test 2.5: Cross-Tenant Audit Log Access ---');
  const auditCrossRes = await makeRequest('/institutes/demo-institute-2/audit-logs', 'GET', token1);
  console.log(`  GET /institutes/demo-institute-2/audit-logs -> Status: ${auditCrossRes.status}`);
  if (auditCrossRes.status === 403 || auditCrossRes.status === 404) {
    console.log('  [PASS] Tenant boundary enforced: Cross-tenant audit logs rejected with HTTP', auditCrossRes.status);
  } else {
    console.error('  [FAIL] Tenant isolation breach! Received:', auditCrossRes.status);
  }

  console.log('\n====================================================');
  console.log('MULTI-TENANT ISOLATION SUITE COMPLETE');
  console.log('====================================================');
}

run().catch(console.error).finally(() => prisma.$disconnect());
