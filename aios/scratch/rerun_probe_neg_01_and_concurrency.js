const { PrismaClient, EvaluationDecision, UserRole } = require('@prisma/client');

const API_BASE = 'http://127.0.0.1:4000/api/v1';
const prisma = new PrismaClient();
const INSTITUTE_ID = 'demo-institute-1';

async function apiCall(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  console.log('====================================================');
  console.log('AIOS AUDIT: PROBE-NEG-01 RERUN & CONCURRENCY TESTS');
  console.log('====================================================\n');

  // 1. Authenticate Teacher
  const teacherAuth = await apiCall('POST', '/auth/dev-login', { role: 'TEACHER' });
  if (teacherAuth.status !== 200 || !teacherAuth.data?.accessToken) {
    throw new Error(`Teacher login failed: ${teacherAuth.status} ${JSON.stringify(teacherAuth.data)}`);
  }
  const teacherToken = teacherAuth.data.accessToken;
  console.log('✓ Teacher Authenticated: token minted.');

  // 2. Find a valid evaluable response in demo-institute-1
  const responseRecord = await prisma.response.findFirst({
    where: {
      attemptId: { not: null },
      attempt: {
        assessmentDelivery: {
          assessment: { instituteId: INSTITUTE_ID },
        },
      },
      question: {
        type: { in: ['SHORT_ANSWER', 'LONG_ANSWER', 'PASSAGE_BASED'] },
      },
    },
    include: {
      question: true,
      attempt: {
        include: { scoreRecord: true },
      },
      evaluation: {
        include: { currentVersion: true, versions: true },
      },
    },
  });

  if (!responseRecord) {
    throw new Error('No valid subjective response found in demo-institute-1');
  }

  const responseId = responseRecord.id;
  const maxMarks = responseRecord.marksAvailable;
  const attemptId = responseRecord.attemptId;
  const initialVersionCount = responseRecord.evaluation?.versions.length || 0;
  const initialAttemptStatus = responseRecord.attempt.status;
  const initialScore = responseRecord.attempt.scoreRecord?.totalMarksObtained;

  console.log(`Target Response ID: ${responseId}`);
  console.log(`Question Max Marks Available: ${maxMarks}`);
  console.log(`Attempt ID: ${attemptId} | Status: ${initialAttemptStatus} | Initial Score: ${initialScore}`);
  console.log(`Initial Evaluation Versions count: ${initialVersionCount}\n`);

  // --------------------------------------------------------------------------
  // TEST 1: PROBE-NEG-01 — Excessive Marks Payload
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: PROBE-NEG-01 (Excessive Marks Submission) ---');
  const excessiveMarksPayload = {
    decision: 'ADJUST',
    marksAwarded: 999.0, // Exceeds marksAvailable
    teacherComment: 'Illegal override exceeding maxMarks',
  };

  console.log(`Submitting POST /institutes/${INSTITUTE_ID}/evaluations/${responseId}/decide with marksAwarded: 999.0...`);
  const excessiveRes = await apiCall(
    'POST',
    `/institutes/${INSTITUTE_ID}/evaluations/${responseId}/decide`,
    excessiveMarksPayload,
    teacherToken
  );

  console.log(`HTTP Status: ${excessiveRes.status}`);
  console.log(`HTTP Response:`, excessiveRes.data);

  if (excessiveRes.status === 400 && excessiveRes.data?.message?.includes('exceeds')) {
    console.log('✓ Expected Validation Error Confirmed (HTTP 400 BadRequestException).');
  } else {
    console.error('❌ Unexpected response for excessive marks:', excessiveRes);
  }

  // Database Verification: Check that NO new version, NO corrupted score, NO attempt mutation occurred
  const postResponseRecord = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      attempt: { include: { scoreRecord: true } },
      evaluation: { include: { versions: true } },
    },
  });

  const postVersionCount = postResponseRecord?.evaluation?.versions.length || 0;
  const postAttemptStatus = postResponseRecord?.attempt?.status;
  const postScore = postResponseRecord?.attempt?.scoreRecord?.totalMarksObtained;

  console.log(`Post-Check Versions count: ${postVersionCount} (Expected: ${initialVersionCount})`);
  console.log(`Post-Check Attempt Status: ${postAttemptStatus} (Expected: ${initialAttemptStatus})`);
  console.log(`Post-Check Score: ${postScore} (Expected: ${initialScore})`);

  const versionsIntegrity = postVersionCount === initialVersionCount;
  const attemptIntegrity = postAttemptStatus === initialAttemptStatus;
  const scoreIntegrity = postScore === initialScore;

  if (versionsIntegrity && attemptIntegrity && scoreIntegrity) {
    console.log('✅ DATABASE INTEGRITY CONFIRMED: No score, version, or attempt record was incorrectly modified.\n');
  } else {
    console.error('❌ DATABASE INTEGRITY VIOLATION DETECTED!');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Concurrency & Duplicate-Request Stress Test
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Concurrency & Duplicate-Request Race Condition Probe ---');
  const validMarks = Math.min(2.5, maxMarks);
  const concurrentPayload = {
    decision: 'ADJUST',
    marksAwarded: validMarks,
    teacherComment: 'Concurrent stress probe decision',
  };

  console.log(`Dispatching 5 concurrent identical POST requests to decide endpoint...`);
  const startTime = Date.now();
  const promises = Array.from({ length: 5 }).map((_, i) =>
    apiCall(
      'POST',
      `/institutes/${INSTITUTE_ID}/evaluations/${responseId}/decide`,
      concurrentPayload,
      teacherToken
    ).then((res) => ({ reqIndex: i, status: res.status, data: res.data }))
  );

  const results = await Promise.all(promises);
  const elapsed = Date.now() - startTime;
  console.log(`Completed 5 concurrent requests in ${elapsed}ms:`);
  results.forEach((r) => {
    console.log(`  Req #${r.reqIndex}: HTTP ${r.status} (Version ID: ${r.data?.id || 'none'}, Error: ${r.data?.message || 'none'})`);
  });

  // Verify DB state after concurrent requests
  const afterConcurrentResponse = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      evaluation: {
        include: {
          versions: { orderBy: { createdAt: 'desc' } },
          currentVersion: true,
        },
      },
    },
  });

  const finalVersions = afterConcurrentResponse?.evaluation?.versions || [];
  console.log(`Final evaluation versions count: ${finalVersions.length}`);
  console.log(`Active current evaluation version: ${afterConcurrentResponse?.evaluation?.currentEvaluationVersionId} (Source: ${afterConcurrentResponse?.evaluation?.currentVersion?.source}, Marks: ${afterConcurrentResponse?.evaluation?.currentVersion?.marksAwarded})`);

  // Check version chain integrity: previousVersionId links
  let brokenChains = 0;
  for (const v of finalVersions) {
    if (v.previousVersionId) {
      const parentExists = finalVersions.some((p) => p.id === v.previousVersionId);
      if (!parentExists) brokenChains++;
    }
  }
  console.log(`Version chain broken links: ${brokenChains}`);
  if (brokenChains === 0) {
    console.log('✅ Version chain integrity preserved under concurrent mutation.\n');
  } else {
    console.error('❌ Version chain broken links detected!');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Negative Role Probe — Student attempting to call decide endpoint
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Negative RBAC Probe — Student Access to Evaluation Desk ---');
  const studentAuth = await apiCall('POST', '/auth/dev-login', { role: 'STUDENT' });
  const studentToken = studentAuth.data.accessToken;

  const studentDecideRes = await apiCall(
    'POST',
    `/institutes/${INSTITUTE_ID}/evaluations/${responseId}/decide`,
    { decision: 'ADJUST', marksAwarded: 1.0 },
    studentToken
  );
  console.log(`Student decide attempt: HTTP ${studentDecideRes.status} (Expected: 403 Forbidden)`);
  if (studentDecideRes.status === 403) {
    console.log('✅ RBAC Gate Confirmed: Student strictly blocked with 403 Forbidden.\n');
  } else {
    console.error('❌ RBAC Gate Failure: Student was not blocked with 403!');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error running test script:', err);
  prisma.$disconnect();
  process.exit(1);
});
