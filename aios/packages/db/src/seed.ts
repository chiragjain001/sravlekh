import { PrismaClient, InstitutePlan, InstituteStatus, UserRole, QuestionType, DifficultyLevel } from '@prisma/client';

const prisma = new PrismaClient();

// Fixed dev-only identities — matched by AuthService.loginAsMockRole() (mock-<role>@aios.dev).
// Never used outside NODE_ENV !== 'production' (see docs/06-AUTH-AUTHORIZATION.md §1).
const MOCK_USERS: Record<UserRole, { email: string; name: string }> = {
  TEACHER: { email: 'mock-teacher@aios.dev', name: 'Rahul Verma' },
  ADMIN: { email: 'mock-admin@aios.dev', name: 'Neha Malhotra' },
  STUDENT: { email: 'mock-student@aios.dev', name: 'Aryan Sharma' },
  FOUNDER: { email: 'mock-founder@aios.dev', name: 'Super Admin' },
};

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create a Demo Institute
  const institute = await prisma.institute.upsert({
    where: { id: 'demo-institute-1' },
    update: {},
    create: {
      id: 'demo-institute-1',
      name: 'Apex Academy (Demo)',
      domainAllowlist: ['gmail.com'],
      plan: InstitutePlan.ENTERPRISE,
      status: InstituteStatus.ACTIVE,
    },
  });
  console.log(`✅ Institute created: ${institute.name}`);

  // 2. Allowlist entries — real Google login for these emails gets the matching role.
  await prisma.allowListEntry.upsert({
    where: { instituteId_email: { instituteId: institute.id, email: 'test@example.com' } },
    update: {},
    create: { instituteId: institute.id, email: 'test@example.com', role: UserRole.FOUNDER },
  });
  for (const [role, info] of Object.entries(MOCK_USERS) as [UserRole, { email: string; name: string }][]) {
    await prisma.allowListEntry.upsert({
      where: { instituteId_email: { instituteId: institute.id, email: info.email } },
      update: {},
      create: { instituteId: institute.id, email: info.email, role },
    });
  }

  // 3. Seeded dev users (one per role) — AuthService.loginAsMockRole() looks these up by email.
  const users: Record<UserRole, { id: string }> = {} as Record<UserRole, { id: string }>;
  for (const [role, info] of Object.entries(MOCK_USERS) as [UserRole, { email: string; name: string }][]) {
    users[role] = await prisma.user.upsert({
      where: { instituteId_email: { instituteId: institute.id, email: info.email } },
      update: { name: info.name },
      create: {
        instituteId: institute.id,
        email: info.email,
        name: info.name,
        googleSub: `mock_${role.toLowerCase()}_seed`,
        role,
        status: 'ACTIVE',
      },
    });
  }
  console.log('✅ Mock dev users created (one per role).');

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: users.TEACHER.id },
    update: {},
    create: {
      userId: users.TEACHER.id,
      qualification: 'M.Sc Physics, IIT Bombay',
    },
  });

  // 4. Create Curriculum (Subject -> Chapters -> Topics) — two chapters so the
  // Assessment Builder's multi-chapter selection UI has something real to show.
  const subject = await prisma.subject.upsert({
    where: { instituteId_name: { instituteId: institute.id, name: 'Physics' } },
    update: {},
    create: { instituteId: institute.id, name: 'Physics', code: 'PHY101' },
  });

  const kinematics = await prisma.chapter.upsert({
    where: { id: 'demo-chapter-kinematics' },
    update: {},
    create: { id: 'demo-chapter-kinematics', subjectId: subject.id, name: 'Kinematics', order: 1 },
  });
  const laws = await prisma.chapter.upsert({
    where: { id: 'demo-chapter-laws-of-motion' },
    update: {},
    create: { id: 'demo-chapter-laws-of-motion', subjectId: subject.id, name: 'Laws of Motion', order: 2 },
  });

  const topicMotion = await prisma.topic.upsert({
    where: { id: 'demo-topic-motion-straight-line' },
    update: {},
    create: { id: 'demo-topic-motion-straight-line', chapterId: kinematics.id, name: 'Motion in a Straight Line', order: 1 },
  });
  const topicProjectile = await prisma.topic.upsert({
    where: { id: 'demo-topic-projectile-motion' },
    update: {},
    create: { id: 'demo-topic-projectile-motion', chapterId: kinematics.id, name: 'Projectile Motion', order: 2 },
  });
  const topicNewton = await prisma.topic.upsert({
    where: { id: 'demo-topic-newtons-laws' },
    update: {},
    create: { id: 'demo-topic-newtons-laws', chapterId: laws.id, name: "Newton's Laws of Motion", order: 1 },
  });
  const topicFriction = await prisma.topic.upsert({
    where: { id: 'demo-topic-friction' },
    update: {},
    create: { id: 'demo-topic-friction', chapterId: laws.id, name: 'Friction', order: 2 },
  });
  console.log(`✅ Curriculum created: ${subject.name} -> ${kinematics.name}, ${laws.name}`);

  // 5. Create a Batch, assign the seeded teacher to it
  const batch = await prisma.batch.upsert({
    where: { id: 'demo-batch-jee-alpha' },
    update: {},
    create: {
      id: 'demo-batch-jee-alpha',
      instituteId: institute.id,
      name: 'JEE Mains 2026 - Batch Alpha',
      classYear: 'Class 11',
      section: 'A',
    },
  });

  const existingAssignment = await prisma.batchTeacher.findFirst({
    where: { batchId: batch.id, teacherProfileId: teacherProfile.id, subjectId: subject.id },
  });
  if (!existingAssignment) {
    await prisma.batchTeacher.create({
      data: { batchId: batch.id, teacherProfileId: teacherProfile.id, subjectId: subject.id },
    });
  }
  console.log(`✅ Batch created: ${batch.name} (teacher assigned)`);

  // 6. Enroll the seeded student into the batch
  await prisma.studentProfile.upsert({
    where: { userId: users.STUDENT.id },
    update: { batchId: batch.id },
    create: { userId: users.STUDENT.id, rollNumber: 'JEE-A-001', batchId: batch.id, tags: [] },
  });

  // 7. Question bank — a handful of approved MCQs per topic/difficulty so the
  // Assessment Builder can actually generate a real paper end-to-end without
  // hitting "not enough questions in bank" on a modest plan.
  const topics = [topicMotion, topicProjectile, topicNewton, topicFriction];
  const difficulties = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD];
  let questionsCreated = 0;

  for (const topic of topics) {
    for (const difficulty of difficulties) {
      for (let i = 1; i <= 4; i++) {
        const id = `demo-q-${topic.id}-${difficulty.toLowerCase()}-${i}`;
        const existing = await prisma.question.findUnique({ where: { id } });
        if (existing) continue;
        await prisma.question.create({
          data: {
            id,
            instituteId: institute.id,
            subjectId: subject.id,
            chapterId: topic.chapterId,
            topicId: topic.id,
            type: QuestionType.MCQ,
            difficulty,
            marks: 4,
            negativeMarks: 1,
            content: `[${difficulty}] Sample question #${i} on ${topic.name}.`,
            options: [
              { label: 'A', text: 'Option A', isCorrect: i % 4 === 0 },
              { label: 'B', text: 'Option B', isCorrect: i % 4 === 1 },
              { label: 'C', text: 'Option C', isCorrect: i % 4 === 2 },
              { label: 'D', text: 'Option D', isCorrect: i % 4 === 3 },
            ],
            solution: `Worked solution for ${topic.name} sample question #${i}.`,
            isApproved: true,
            createdByUserId: users.TEACHER.id,
          },
        });
        questionsCreated += 1;
      }
    }
  }
  console.log(`✅ Question bank seeded (${questionsCreated} new questions).`);

  // 8. Two subjective questions (SHORT_ANSWER/LONG_ANSWER) — only these types
  // ever reach the evaluation queue (see evaluations.service.ts's
  // SUBJECTIVE_QUESTION_TYPES); the digital-copy pipeline has nothing to grade
  // without at least one.
  await prisma.question.upsert({
    where: { id: 'demo-q-short-answer-newton' },
    update: {},
    create: {
      id: 'demo-q-short-answer-newton',
      instituteId: institute.id,
      subjectId: subject.id,
      chapterId: laws.id,
      topicId: topicNewton.id,
      type: QuestionType.SHORT_ANSWER,
      difficulty: DifficultyLevel.MEDIUM,
      marks: 5,
      negativeMarks: 0,
      content: "State Newton's Second Law of Motion and write its mathematical form.",
      solution: 'F = ma — the net force on a body is directly proportional to its mass and acceleration.',
      isApproved: true,
      createdByUserId: users.TEACHER.id,
    },
  });
  await prisma.question.upsert({
    where: { id: 'demo-q-long-answer-friction' },
    update: {},
    create: {
      id: 'demo-q-long-answer-friction',
      instituteId: institute.id,
      subjectId: subject.id,
      chapterId: laws.id,
      topicId: topicFriction.id,
      type: QuestionType.LONG_ANSWER,
      difficulty: DifficultyLevel.HARD,
      marks: 10,
      negativeMarks: 0,
      content: 'Derive an expression for the acceleration of a block sliding down a rough inclined plane, and explain the role of the coefficient of friction.',
      solution: 'a = g(sinθ − μcosθ), derived from resolving gravity and friction along the incline.',
      isApproved: true,
      createdByUserId: users.TEACHER.id,
    },
  });
  console.log('✅ Subjective questions seeded (for the digital evaluation queue).');

  // 9. Capture provider + evaluation policy — both admin-only to create, so a
  // teacher's dev environment has nothing to pick from without seeding them.
  const captureProvider = await prisma.captureProvider.upsert({
    where: { id: 'demo-capture-provider-photo-subjective' },
    update: {},
    create: {
      id: 'demo-capture-provider-photo-subjective',
      instituteId: institute.id,
      type: 'PHOTO_CAPTURE_SUBJECTIVE',
      // No bookletTemplateId -> Document.layoutType resolves to FREE_FORM
      // (documents.service.ts), the simpler of the two real pipelines.
      config: { expectedPageCount: 2, identityResolutionMethod: 'MANUAL_ADMIN_MATCH' },
    },
  });
  const evaluationPolicy = await prisma.evaluationPolicy.upsert({
    where: { id: 'demo-evaluation-policy-ai-assist' },
    update: {},
    create: {
      id: 'demo-evaluation-policy-ai-assist',
      instituteId: institute.id,
      name: 'AI-Assisted, Mandatory Teacher Review',
      mode: 'AI_ASSIST_MANDATORY_REVIEW',
      requiresHumanReview: true,
    },
  });
  console.log(`✅ Capture provider + evaluation policy seeded (${captureProvider.id}, ${evaluationPolicy.id}).`);

  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1; // let .finally() below actually run and release the pooled connection
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
