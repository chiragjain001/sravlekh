import axios from 'axios';
import { PrismaClient, DoubtStatus, QuestionStatus, ExamStatus, QuestionType, DifficultyLevel, ExamType, AssignmentScope } from '@prisma/client';

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();
const INSTITUTE_ID = 'demo-institute-1';

interface WorkflowLog {
  step: string;
  role: string;
  action: string;
  apiEndpoint: string;
  apiStatus: number;
  dbVerification: string;
  status: 'PASS' | 'FAIL';
  details?: any;
}

const logs: WorkflowLog[] = [];

async function loginAs(role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'FOUNDER') {
  const res = await axios.post(`${API_BASE}/auth/dev-login`, { role });
  return {
    token: res.data.accessToken,
    user: res.data.user,
  };
}

async function runLiveWorkflows() {
  console.log('🚀 Executing End-to-End Multi-Role Business Workflows on Apex Academy (demo-institute-1)...\n');

  // Authenticate as all 4 roles
  const studentAuth = await loginAs('STUDENT');
  const teacherAuth = await loginAs('TEACHER');
  const adminAuth = await loginAs('ADMIN');
  const founderAuth = await loginAs('FOUNDER');

  const studentHeaders = { Authorization: `Bearer ${studentAuth.token}` };
  const teacherHeaders = { Authorization: `Bearer ${teacherAuth.token}` };
  const adminHeaders = { Authorization: `Bearer ${adminAuth.token}` };
  const founderHeaders = { Authorization: `Bearer ${founderAuth.token}` };

  // Fetch student profile ID
  const studentProfile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: studentAuth.user.id },
  });
  // Fetch teacher profile ID
  const teacherProfile = await prisma.teacherProfile.findUniqueOrThrow({
    where: { userId: teacherAuth.user.id },
  });

  // Fetch subject, chapter & topic in demo-institute-1
  const physicsSubject = await prisma.subject.findFirstOrThrow({
    where: { instituteId: INSTITUTE_ID, name: 'Physics' },
    include: { chapters: { include: { topics: true } } },
  });
  const chapter = physicsSubject.chapters[0];
  const topic = chapter.topics[0];

  const batch10A = await prisma.batch.findFirstOrThrow({
    where: { instituteId: INSTITUTE_ID, name: { contains: '10' } },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // WORKFLOW A: Student Creates Doubt -> Teacher Claims & Resolves -> Student Reads
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- Workflow A: Student Doubt Lifecycle ---');
  let createdDoubtId = '';

  // Step A1: Student creates doubt
  try {
    const doubtPayload = {
      subjectId: physicsSubject.id,
      topicId: topic.id,
      urgency: 2,
      content: 'Why does an object in uniform circular motion accelerate toward the center even if speed is constant?',
    };
    const res = await axios.post(
      `${API_BASE}/institutes/${INSTITUTE_ID}/students/${studentProfile.id}/doubts`,
      doubtPayload,
      { headers: studentHeaders }
    );
    const dData = res.data.data ?? res.data;
    createdDoubtId = dData.id;

    // Verify in DB
    const dbDoubt = await prisma.doubtTicket.findUnique({ where: { id: createdDoubtId } });
    const pass = (res.status === 201 || res.status === 200) && dbDoubt?.status === DoubtStatus.OPEN;

    logs.push({
      step: 'A1',
      role: 'STUDENT',
      action: 'Create Doubt Ticket in Physics',
      apiEndpoint: `POST /institutes/${INSTITUTE_ID}/students/${studentProfile.id}/doubts`,
      apiStatus: res.status,
      dbVerification: `DoubtTicket #${createdDoubtId} created with status: ${dbDoubt?.status}`,
      status: pass ? 'PASS' : 'FAIL',
    });
  } catch (err: any) {
    logs.push({
      step: 'A1',
      role: 'STUDENT',
      action: 'Create Doubt Ticket',
      apiEndpoint: `POST /institutes/${INSTITUTE_ID}/students/${studentProfile.id}/doubts`,
      apiStatus: err.response?.status ?? 500,
      dbVerification: 'Creation failed',
      status: 'FAIL',
      details: err.response?.data ?? err.message,
    });
  }

  // Step A2: Teacher views and claims the doubt
  if (createdDoubtId) {
    try {
      const res = await axios.patch(
        `${API_BASE}/institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}/assign`,
        { teacherUserId: teacherAuth.user.id },
        { headers: teacherHeaders }
      );
      const dbDoubt = await prisma.doubtTicket.findUnique({ where: { id: createdDoubtId } });
      const pass = res.status === 200 && dbDoubt?.assignedTeacherId === teacherAuth.user.id;

      logs.push({
        step: 'A2',
        role: 'TEACHER',
        action: 'Claim / Assign Doubt Ticket to Self',
        apiEndpoint: `PATCH /institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}/assign`,
        apiStatus: res.status,
        dbVerification: `Doubt assignedTeacherId: ${dbDoubt?.assignedTeacherId} (matches Teacher User #${teacherAuth.user.id})`,
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      logs.push({
        step: 'A2',
        role: 'TEACHER',
        action: 'Claim Doubt Ticket',
        apiEndpoint: `PATCH /institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}/assign`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: 'Claim failed',
        status: 'FAIL',
        details: err.response?.data ?? err.message,
      });
    }

    // Step A3: Teacher resolves the doubt
    try {
      const resolutionPayload = {
        resolutionText: 'Velocity is a vector quantity. Even when speed (scalar magnitude) is constant, the direction continuously changes tangent to the circle. By Newton’s second law, this directional change produces a centripetal acceleration a = v²/r directed toward the rotation center.',
      };
      const res = await axios.post(
        `${API_BASE}/institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}/resolve`,
        resolutionPayload,
        { headers: teacherHeaders }
      );
      const dbDoubt = await prisma.doubtTicket.findUnique({ where: { id: createdDoubtId } });
      const pass = (res.status === 200 || res.status === 201) && dbDoubt?.status === DoubtStatus.ANSWERED && !!dbDoubt?.resolvedAt;

      logs.push({
        step: 'A3',
        role: 'TEACHER',
        action: 'Resolve Doubt Ticket with Academic Explanation',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}/resolve`,
        apiStatus: res.status,
        dbVerification: `Doubt status: ${dbDoubt?.status}, resolvedAt: ${dbDoubt?.resolvedAt?.toISOString()}`,
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      logs.push({
        step: 'A3',
        role: 'TEACHER',
        action: 'Resolve Doubt Ticket',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}/resolve`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: 'Resolution failed',
        status: 'FAIL',
        details: err.response?.data ?? err.message,
      });
    }

    // Step A4: Student reads resolved doubt
    try {
      const res = await axios.get(
        `${API_BASE}/institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}`,
        { headers: studentHeaders }
      );
      const data = res.data.data ?? res.data;
      const pass = res.status === 200 && (data.status === 'ANSWERED' || data.status === 'RESOLVED');

      logs.push({
        step: 'A4',
        role: 'STUDENT',
        action: 'View Resolved Doubt Ticket & Explanation',
        apiEndpoint: `GET /institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}`,
        apiStatus: res.status,
        dbVerification: `Student read verified status: ${data.status}`,
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      logs.push({
        step: 'A4',
        role: 'STUDENT',
        action: 'View Resolved Doubt Ticket',
        apiEndpoint: `GET /institutes/${INSTITUTE_ID}/doubts/${createdDoubtId}`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: 'Read failed',
        status: 'FAIL',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // WORKFLOW B: Teacher Authors Question -> Admin Approves Question
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Workflow B: Question Authoring & Governance ---');
  let createdQuestionId = '';

  // Step B1: Teacher creates a curriculum question in Physics
  try {
    const questionPayload = {
      subjectId: physicsSubject.id,
      chapterId: chapter.id,
      topicId: topic.id,
      type: QuestionType.SHORT_ANSWER,
      difficulty: DifficultyLevel.MEDIUM,
      marks: 4,
      content: 'State Newton’s First Law of Motion and provide one practical real-life example.',
    };
    const res = await axios.post(
      `${API_BASE}/institutes/${INSTITUTE_ID}/questions`,
      questionPayload,
      { headers: teacherHeaders }
    );
    const qData = res.data.data ?? res.data;
    createdQuestionId = qData.id;

    const dbQ = await prisma.question.findUnique({ where: { id: createdQuestionId } });
    const pass = (res.status === 200 || res.status === 201) && !!dbQ;

    logs.push({
      step: 'B1',
      role: 'TEACHER',
      action: 'Author New Physics Question',
      apiEndpoint: `POST /institutes/${INSTITUTE_ID}/questions`,
      apiStatus: res.status,
      dbVerification: `Question #${createdQuestionId} created with initial status: ${dbQ?.status}`,
      status: pass ? 'PASS' : 'FAIL',
    });
  } catch (err: any) {
    logs.push({
      step: 'B1',
      role: 'TEACHER',
      action: 'Author Question',
      apiEndpoint: `POST /institutes/${INSTITUTE_ID}/questions`,
      apiStatus: err.response?.status ?? 500,
      dbVerification: 'Creation failed',
      status: 'FAIL',
      details: err.response?.data ?? err.message,
    });
  }

  // Step B2: Teacher cannot approve own authored question (Admin/Founder only)
  if (createdQuestionId) {
    try {
      const res = await axios.post(
        `${API_BASE}/institutes/${INSTITUTE_ID}/questions/${createdQuestionId}/approve`,
        {},
        { headers: teacherHeaders }
      );
      logs.push({
        step: 'B2',
        role: 'TEACHER',
        action: 'Attempt Self-Approval of Question (Should Fail)',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/questions/${createdQuestionId}/approve`,
        apiStatus: res.status,
        dbVerification: 'Security issue: teacher was able to approve question',
        status: 'FAIL',
      });
    } catch (err: any) {
      const pass = err.response?.status === 403;
      logs.push({
        step: 'B2',
        role: 'TEACHER',
        action: 'Attempt Approval of Question (Role Gate Verification)',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/questions/${createdQuestionId}/approve`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: `Blocked by RolesGuard (${err.response?.status} Forbidden - Admin/Founder only)`,
        status: pass ? 'PASS' : 'FAIL',
      });
    }

    // Step B3: Admin approves the question
    try {
      const res = await axios.post(
        `${API_BASE}/institutes/${INSTITUTE_ID}/questions/${createdQuestionId}/approve`,
        {},
        { headers: adminHeaders }
      );
      const dbQ = await prisma.question.findUnique({ where: { id: createdQuestionId } });
      const pass = res.status === 200 && dbQ?.status === QuestionStatus.APPROVED;

      logs.push({
        step: 'B3',
        role: 'ADMIN',
        action: 'Approve Curriculum Question for Use in Papers',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/questions/${createdQuestionId}/approve`,
        apiStatus: res.status,
        dbVerification: `Question #${createdQuestionId} DB status transitioned to: ${dbQ?.status}`,
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      logs.push({
        step: 'B3',
        role: 'ADMIN',
        action: 'Approve Question',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/questions/${createdQuestionId}/approve`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: 'Approval failed',
        status: 'FAIL',
        details: err.response?.data ?? err.message,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // WORKFLOW C: Admin Exam Creation -> Evaluator Assignment -> Monotonic Print Run
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Workflow C: Examination Lifecycle & Evaluator Assignment ---');
  let createdExamId = '';
  let deliveryId = '';

  // Step C1: Admin creates an Exam linked to batch
  try {
    let blueprint = await prisma.blueprint.findFirst({ where: { instituteId: INSTITUTE_ID } });
    if (!blueprint) {
      blueprint = await prisma.blueprint.create({
        data: {
          instituteId: INSTITUTE_ID,
          subjectId: physicsSubject.id,
          name: 'Standard Physics Midterm Blueprint',
          totalMarks: 50,
          durationMinutes: 60,
          config: { sections: [{ name: 'Part A', count: 10, marks: 5 }] },
        },
      });
    }

    const examPayload = {
      title: `Pre-Launch Live Verification Exam ${Date.now()}`,
      batchId: batch10A.id,
      blueprintId: blueprint.id,
      type: ExamType.UNIT_TEST,
      totalMarks: 50,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
    };
    const res = await axios.post(
      `${API_BASE}/institutes/${INSTITUTE_ID}/exams`,
      examPayload,
      { headers: adminHeaders }
    );
    const examData = res.data.data ?? res.data;
    createdExamId = examData.id;
    deliveryId = examData.assessmentDeliveryId;

    const dbExam = await prisma.exam.findUnique({
      where: { id: createdExamId },
      include: { assessmentDelivery: { include: { assessment: true } } },
    });
    const pass = res.status === 201 && dbExam?.assessmentDeliveryId === deliveryId && !!dbExam?.assessmentDelivery?.assessmentId;

    logs.push({
      step: 'C1',
      role: 'ADMIN',
      action: 'Create Canonical Exam & Delivery',
      apiEndpoint: `POST /institutes/${INSTITUTE_ID}/exams`,
      apiStatus: res.status,
      dbVerification: `Exam #${createdExamId} linked to Assessment #${dbExam?.assessmentDelivery?.assessmentId} and Delivery #${deliveryId}`,
      status: pass ? 'PASS' : 'FAIL',
    });
  } catch (err: any) {
    logs.push({
      step: 'C1',
      role: 'ADMIN',
      action: 'Create Exam',
      apiEndpoint: `POST /institutes/${INSTITUTE_ID}/exams`,
      apiStatus: err.response?.status ?? 500,
      dbVerification: 'Creation failed',
      status: 'FAIL',
      details: err.response?.data ?? err.message,
    });
  }

  // Step C2: Admin assigns Teacher as Evaluator for this delivery
  if (deliveryId) {
    try {
      const assignPayload = {
        teacherProfileId: teacherProfile.id,
        scope: AssignmentScope.BATCH,
        isLeadEvaluator: true,
      };
      const res = await axios.post(
        `${API_BASE}/institutes/${INSTITUTE_ID}/deliveries/${deliveryId}/copy-checkers`,
        assignPayload,
        { headers: adminHeaders }
      );
      const dbAssignment = await prisma.copyCheckerAssignment.findFirst({
        where: { assessmentDeliveryId: deliveryId, teacherProfileId: teacherProfile.id },
      });
      const pass = (res.status === 200 || res.status === 201) && !!dbAssignment;

      logs.push({
        step: 'C2',
        role: 'ADMIN',
        action: 'Assign Faculty as Primary Copy-Checker',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/deliveries/${deliveryId}/copy-checkers`,
        apiStatus: res.status,
        dbVerification: `CopyCheckerAssignment #${dbAssignment?.id} active for Delivery #${deliveryId} (scope: ${dbAssignment?.scope})`,
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      logs.push({
        step: 'C2',
        role: 'ADMIN',
        action: 'Assign Evaluator',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/deliveries/${deliveryId}/copy-checkers`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: 'Assignment failed',
        status: 'FAIL',
        details: err.response?.data ?? err.message,
      });
    }

    // Step C3: Admin generates monotonic booklet print run
    try {
      const printRunPayload = {
        count: 5,
        maxRollDigits: 6,
      };
      const res = await axios.post(
        `${API_BASE}/institutes/${INSTITUTE_ID}/deliveries/${deliveryId}/print-runs`,
        printRunPayload,
        { headers: adminHeaders }
      );
      const raw = res.data.data ?? res.data;
      const printRunId = raw.printRun?.id ?? raw.id;
      const dbPrintRun = await prisma.bookletPrintRun.findUnique({
        where: { id: printRunId },
        include: { booklets: true },
      });
      const pass = (res.status === 200 || res.status === 201) && dbPrintRun?.booklets.length === 5;

      logs.push({
        step: 'C3',
        role: 'ADMIN',
        action: 'Generate Monotonic Booklet Print Run (5 Booklets)',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/deliveries/${deliveryId}/print-runs`,
        apiStatus: res.status,
        dbVerification: `PrintRun #${printRunId} generated ${dbPrintRun?.booklets.length} Booklets with HMAC QR codes`,
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      logs.push({
        step: 'C3',
        role: 'ADMIN',
        action: 'Generate Print Run',
        apiEndpoint: `POST /institutes/${INSTITUTE_ID}/deliveries/${deliveryId}/print-runs`,
        apiStatus: err.response?.status ?? 500,
        dbVerification: 'Print run failed',
        status: 'FAIL',
        details: err.response?.data ?? err.message,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // WORKFLOW D: Founder Global Governance
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Workflow D: Founder Governance & Feature Flags ---');
  try {
    const res = await axios.get(`${API_BASE}/founder/institutes`, { headers: founderHeaders });
    const institutes = res.data.data ?? res.data;
    const apex = institutes.find((i: any) => i.id === INSTITUTE_ID);
    const pass = res.status === 200 && !!apex;

    logs.push({
      step: 'D1',
      role: 'FOUNDER',
      action: 'Global Directory Query & Multi-Tenant Audit',
      apiEndpoint: 'GET /founder/institutes',
      apiStatus: res.status,
      dbVerification: `Founder retrieved ${institutes.length} registered institutes, Apex Academy status: ${apex?.status}`,
      status: pass ? 'PASS' : 'FAIL',
    });
  } catch (err: any) {
    logs.push({
      step: 'D1',
      role: 'FOUNDER',
      action: 'Global Directory Query',
      apiEndpoint: 'GET /founder/institutes',
      apiStatus: err.response?.status ?? 500,
      dbVerification: 'Founder access failed',
      status: 'FAIL',
    });
  }

  // Print Summary Table
  console.log('\n========================================================================================');
  console.log('                 END-TO-END LIVE BUSINESS WORKFLOW EXECUTION RESULTS                    ');
  console.log('========================================================================================\n');

  for (const l of logs) {
    const icon = l.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${l.step}] ${l.role} -> ${l.action}`);
    console.log(`   Endpoint:   ${l.apiEndpoint} (HTTP ${l.apiStatus})`);
    console.log(`   DB Verify:  ${l.dbVerification}`);
    if (l.details) console.log(`   Details:    ${JSON.stringify(l.details)}`);
    console.log('');
  }

  const passed = logs.filter(l => l.status === 'PASS').length;
  console.log(`Summary: ${passed}/${logs.length} Live Workflows Successfully Executed & Verified in Database!`);
}

runLiveWorkflows()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
