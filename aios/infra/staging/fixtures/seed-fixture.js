/* Seeds one complete, repeatable answer-sheet scenario into the STAGING database.
 *
 *   node infra/staging/fixtures/seed-fixture.js        (built)
 *   pnpm --filter @aios/db exec tsx ../../infra/staging/fixtures/seed-fixture.ts
 *
 * Refuses to run against anything but a nominated staging target — same guard as
 * migrate-staging.js, because this writes institutes, users and questions.
 *
 * What it creates (fixed ids, so re-running is an update, never a duplicate):
 *   - an institute with documentProcessing + aiEvaluation enabled
 *   - the mock teacher/student dev-login identities, a batch and a student with roll no. 12
 *   - five questions covering the cases that matter: a numerical WITHOUT a
 *     reference answer (the model must solve it), a theory question WITH one, a
 *     Hindi question, one written in LaTeX, and an objective MCQ that must never
 *     go near the subjective pipeline
 *   - a paper, a PHOTO_CAPTURE_SUBJECTIVE delivery and an evaluation policy that
 *     mandates human review
 *
 * The booklet itself comes from make-answer-sheet.py, whose answers are written
 * to match these questions.
 */
const path = require('path');
// Resolved from packages/db, which owns the generated client — this script sits
// outside any workspace package.
const { PrismaClient } = require(require.resolve('@prisma/client', {
  paths: [path.join(__dirname, '..', '..', '..', 'packages', 'db')],
}));

const { loadStagingEnv, fail } = require('../staging-env');
const { checkPostgresTarget } = require('../staging-targets');

const staging = loadStagingEnv({ required: ['DATABASE_URL', 'DIRECT_URL', 'STAGING_DB_ALLOWLIST'] });
for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
  const result = checkPostgresTarget(name, staging[name], staging.STAGING_DB_ALLOWLIST);
  if (!result.ok) fail(result.reason);
}
process.env.DATABASE_URL = staging.DATABASE_URL;
process.env.DIRECT_URL = staging.DIRECT_URL;

const prisma = new PrismaClient({ datasources: { db: { url: staging.DATABASE_URL } } });

const ID = {
  institute: 'fx-institute',
  teacherUser: 'fx-user-teacher',
  studentUser: 'fx-user-student',
  founderUser: 'fx-user-founder',
  teacherProfile: 'fx-teacher-1',
  studentProfile: 'fx-student-1',
  batch: 'fx-batch',
  subject: 'fx-subject',
  chapter: 'fx-chapter',
  topic: 'fx-topic',
  blueprint: 'fx-blueprint',
  paper: 'fx-paper',
  assessment: 'fx-assessment',
  delivery: 'fx-delivery',
  captureProvider: 'fx-capture-photo',
  policy: 'fx-policy',
};

/** Question 5 is objective on purpose: it must be scored at capture and never reach the AI. */
const QUESTIONS = [
  {
    id: 'fx-q1',
    type: 'NUMERICAL',
    marks: 4,
    content: 'A car accelerates uniformly from rest to 20 m/s in 5 s. Find its acceleration and the distance covered.',
    solution: null, // no reference answer — the model solves it itself
    subjective: true,
  },
  {
    id: 'fx-q2',
    type: 'LONG_ANSWER',
    marks: 5,
    content: 'Explain the process of photosynthesis and write its balanced chemical equation.',
    solution:
      'Photosynthesis is the process by which green plants convert light energy into chemical energy. Chlorophyll absorbs sunlight; carbon dioxide and water are converted into glucose and oxygen. 6CO2 + 6H2O -> C6H12O6 + 6O2.',
    subjective: true,
  },
  {
    id: 'fx-q3',
    type: 'SHORT_ANSWER',
    marks: 5,
    content: 'न्यूटन का गति का पहला नियम लिखिए और एक दैनिक जीवन का उदाहरण दीजिए।',
    solution: null,
    subjective: true,
  },
  {
    id: 'fx-q4',
    type: 'NUMERICAL',
    marks: 3,
    content: 'Find the kinetic energy of a 2 kg body moving at 3 m/s. Use $KE = \\frac{1}{2}mv^2$.',
    solution: '$KE = \\frac{1}{2} \\times 2 \\times 3^2 = 9$ J',
    subjective: true,
  },
  {
    id: 'fx-q5',
    type: 'MCQ',
    marks: 1,
    content: 'Which of these is a state of matter?',
    solution: 'Solid',
    subjective: false,
  },
];

async function main() {
  const now = new Date();

  const institute = await prisma.institute.upsert({
    where: { id: ID.institute },
    update: { featureFlags: { documentProcessing: true, aiEvaluation: true } },
    create: {
      id: ID.institute,
      name: 'Staging Fixture School',
      domainAllowlist: ['aios.dev'],
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      featureFlags: { documentProcessing: true, aiEvaluation: true },
    },
  });

  // Dev-login identities (AuthService.loginAsMockRole looks these up by email).
  const people = [
    { id: ID.teacherUser, email: 'mock-teacher@aios.dev', name: 'Meera Rao', role: 'TEACHER' },
    { id: ID.studentUser, email: 'mock-student@aios.dev', name: 'Asha Verma', role: 'STUDENT' },
    { id: ID.founderUser, email: 'mock-founder@aios.dev', name: 'Fixture Founder', role: 'FOUNDER' },
  ];
  for (const person of people) {
    await prisma.user.upsert({
      where: { id: person.id },
      update: { name: person.name, role: person.role, status: 'ACTIVE', instituteId: institute.id },
      create: { ...person, instituteId: institute.id, googleSub: `fixture_${person.role.toLowerCase()}`, status: 'ACTIVE' },
    });
    await prisma.allowListEntry.upsert({
      where: { instituteId_email: { instituteId: institute.id, email: person.email } },
      update: { role: person.role },
      create: { instituteId: institute.id, email: person.email, role: person.role },
    });
  }

  const batch = await prisma.batch.upsert({
    where: { id: ID.batch },
    update: {},
    create: { id: ID.batch, instituteId: institute.id, name: 'Class 9 — A', classYear: 'Class 9', isActive: true },
  });
  await prisma.teacherProfile.upsert({
    where: { id: ID.teacherProfile },
    update: {},
    create: { id: ID.teacherProfile, userId: ID.teacherUser, qualification: 'M.Sc.', subjectIds: [ID.subject] },
  });
  await prisma.studentProfile.upsert({
    where: { id: ID.studentProfile },
    update: { batchId: batch.id, rollNumber: '12' },
    create: { id: ID.studentProfile, userId: ID.studentUser, rollNumber: '12', batchId: batch.id },
  });

  const subject = await prisma.subject.upsert({
    where: { id: ID.subject },
    update: {},
    create: { id: ID.subject, instituteId: institute.id, name: 'Science', code: 'SCI' },
  });
  await prisma.chapter.upsert({
    where: { id: ID.chapter },
    update: {},
    create: { id: ID.chapter, subjectId: subject.id, name: 'Motion and Life Processes', order: 1 },
  });
  await prisma.topic.upsert({
    where: { id: ID.topic },
    update: {},
    create: { id: ID.topic, chapterId: ID.chapter, name: 'Motion', order: 1 },
  });

  for (const question of QUESTIONS) {
    await prisma.question.upsert({
      where: { id: question.id },
      update: { content: question.content, solution: question.solution, marks: question.marks },
      create: {
        id: question.id,
        instituteId: institute.id,
        subjectId: subject.id,
        chapterId: ID.chapter,
        topicId: ID.topic,
        type: question.type,
        difficulty: 'MEDIUM',
        marks: question.marks,
        content: question.content,
        solution: question.solution,
        isApproved: true,
        createdByUserId: ID.teacherUser,
        ...(question.type === 'MCQ'
          ? { options: [{ label: 'A', text: 'Solid', isCorrect: true }, { label: 'B', text: 'Gravity', isCorrect: false }] }
          : {}),
      },
    });
  }

  const totalMarks = QUESTIONS.reduce((sum, q) => sum + q.marks, 0);
  await prisma.blueprint.upsert({
    where: { id: ID.blueprint },
    update: {},
    create: {
      id: ID.blueprint,
      instituteId: institute.id,
      subjectId: subject.id,
      name: 'Fixture blueprint',
      totalMarks,
      duration: 60,
      distribution: [{ topicId: ID.topic, marks: totalMarks, difficulty: 'MEDIUM', count: QUESTIONS.length }],
      createdByUserId: ID.teacherUser,
    },
  });
  await prisma.paper.upsert({
    where: { id: ID.paper },
    update: {},
    create: {
      id: ID.paper,
      instituteId: institute.id,
      blueprintId: ID.blueprint,
      title: 'Unit Test — Motion & Life Processes',
      status: 'APPROVED',
      createdByUserId: ID.teacherUser,
    },
  });
  for (const [index, question] of QUESTIONS.entries()) {
    await prisma.paperItem.upsert({
      where: { paperId_questionId: { paperId: ID.paper, questionId: question.id } },
      update: { order: index, marks: question.marks },
      create: { paperId: ID.paper, questionId: question.id, order: index, marks: question.marks },
    });
  }

  await prisma.captureProvider.upsert({
    where: { id: ID.captureProvider },
    update: {},
    create: { id: ID.captureProvider, instituteId: institute.id, type: 'PHOTO_CAPTURE_SUBJECTIVE', config: {} },
  });
  await prisma.evaluationPolicy.upsert({
    where: { id: ID.policy },
    update: {},
    create: {
      id: ID.policy,
      instituteId: institute.id,
      name: 'AI assist, human review mandatory',
      mode: 'AI_ASSIST_MANDATORY_REVIEW',
      requiresHumanReview: true,
    },
  });

  await prisma.assessment.upsert({
    where: { id: ID.assessment },
    update: { totalMarks },
    create: {
      id: ID.assessment,
      instituteId: institute.id,
      title: 'Unit Test — Motion & Life Processes',
      assessmentKind: 'SCHOOL_THEORY_EXAM',
      stakesLevel: 'GRADED',
      subjectIds: [subject.id],
      paperId: ID.paper,
      totalMarks,
      createdByUserId: ID.teacherUser,
    },
  });
  await prisma.assessmentDelivery.upsert({
    where: { id: ID.delivery },
    update: { status: 'ONGOING' },
    create: {
      id: ID.delivery,
      assessmentId: ID.assessment,
      batchId: batch.id,
      status: 'ONGOING',
      captureProviderId: ID.captureProvider,
      evaluationPolicyId: ID.policy,
      scheduledStart: now,
      createdByUserId: ID.teacherUser,
    },
  });

  // A clean slate for THIS fixture's delivery only: booklets, attempts and the
  // evaluation history hanging off them. Re-running the fixture then reproduces
  // the same scenario from scratch instead of colliding with the last run's
  // student link ("already linked to this student for this delivery").
  const priorAttempts = await prisma.attempt.findMany({ where: { assessmentDeliveryId: ID.delivery }, select: { id: true } });
  await prisma.document.deleteMany({ where: { documentBundle: { assessmentDeliveryId: ID.delivery } } });
  await prisma.documentBundle.deleteMany({ where: { assessmentDeliveryId: ID.delivery } });
  await prisma.attempt.deleteMany({ where: { assessmentDeliveryId: ID.delivery } });
  if (priorAttempts.length) console.error(`cleared ${priorAttempts.length} attempt(s) from a previous run`);

  console.log(
    JSON.stringify(
      {
        instituteId: institute.id,
        deliveryId: ID.delivery,
        assessmentId: ID.assessment,
        batchId: batch.id,
        studentProfileId: ID.studentProfile,
        subjectId: subject.id,
        questions: QUESTIONS.map((q, i) => ({ number: i + 1, id: q.id, marks: q.marks, subjective: q.subjective })),
        totalMarks,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
