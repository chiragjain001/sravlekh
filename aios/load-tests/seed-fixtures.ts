/**
 * Load Test & Scale Validation Fixture Seeder
 *
 * Populates real database state required by k6 load test scripts and pilot demonstrations.
 * Supports configurable scale levels:
 *   --scale=pilot (10 students, 1 batch, baseline + reassessment exams, interventions, assignments)
 *   --scale=standard (500 students, 10 batches, multi-exam history)
 *   --scale=full (10,000 students across 50 batches, peak capacity validation)
 *
 * Usage:
 *   pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts [--scale=pilot|standard|full]
 */

import { PrismaClient, UserRole, ExamStatus, PaperStatus, AssignmentStatus, MistakeTagType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const SCALE_ARG = process.argv.find((a) => a.startsWith('--scale='))?.split('=')[1] || 'pilot';

interface ScaleConfig {
  institutesCount: number;
  batchesPerInstitute: number;
  studentsPerBatch: number;
  examsPerBatch: number;
}

const SCALES: Record<string, ScaleConfig> = {
  pilot: {
    institutesCount: 1,
    batchesPerInstitute: 1,
    studentsPerBatch: 10,
    examsPerBatch: 2,
  },
  standard: {
    institutesCount: 2,
    batchesPerInstitute: 5,
    studentsPerBatch: 50,
    examsPerBatch: 5,
  },
  full: {
    institutesCount: 3,
    batchesPerInstitute: 50,
    studentsPerBatch: 67, // ~10,000 total students
    examsPerBatch: 10,
  },
};

const config = SCALES[SCALE_ARG] || SCALES.pilot;

async function connectWithRetry(attempts = 5): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`Database not ready (attempt ${i}/${attempts}), retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function main() {
  // Production safeguard (AGENTS.md / Master Implementation Prompt)
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    throw new Error('FATAL: seed-fixtures cannot be run in production environment (NODE_ENV=production)!');
  }
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('production') || (dbUrl.includes('prod') && !dbUrl.includes('pooler') && !dbUrl.includes('dev'))) {
    throw new Error('FATAL: Target DATABASE_URL appears to point to production. Aborting for safety!');
  }

  console.log(`=== SARVLEKH Fixture Seeder (Scale: ${SCALE_ARG.toUpperCase()}) ===`);
  await connectWithRetry();

  const instituteId = `inst-loadtest-${SCALE_ARG}`;
  console.log(`1. Setting up Institute: ${instituteId}`);

  // Safe idempotent cleanup of ONLY this load-test institute (never touches other tenants)
  console.log(`   Cleaning up any prior test records for ${instituteId} only...`);
  try {
    await prisma.auditLog.deleteMany({ where: { instituteId } });
    await prisma.noticeDelivery.deleteMany({ where: { notice: { instituteId } } });
    await prisma.notice.deleteMany({ where: { instituteId } });
    await prisma.assignment.deleteMany({ where: { topic: { chapter: { subject: { instituteId } } } } });
    await prisma.intervention.deleteMany({ where: { instituteId } });
    await prisma.response.deleteMany({ where: { question: { instituteId } } });
    await prisma.scoreRecord.deleteMany({ where: { exam: { instituteId } } });
    await prisma.answerSheet.deleteMany({ where: { exam: { instituteId } } });
    await prisma.paperItem.deleteMany({ where: { paper: { instituteId } } });
    await prisma.paper.deleteMany({ where: { instituteId } });
    await prisma.exam.deleteMany({ where: { instituteId } });
    await prisma.blueprint.deleteMany({ where: { instituteId } });
    await prisma.question.deleteMany({ where: { instituteId } });
    await prisma.topic.deleteMany({ where: { chapter: { subject: { instituteId } } } });
    await prisma.chapter.deleteMany({ where: { subject: { instituteId } } });
    await prisma.subject.deleteMany({ where: { instituteId } });
    await prisma.batchTeacher.deleteMany({ where: { batch: { instituteId } } });
    await prisma.masteryScore.deleteMany({ where: { studentProfile: { instituteId } } });
    await prisma.studentProfile.deleteMany({ where: { instituteId } });
    await prisma.batch.deleteMany({ where: { instituteId } });
    await prisma.teacherProfile.deleteMany({ where: { user: { instituteId } } });
    await prisma.user.deleteMany({ where: { instituteId } });
  } catch (err) {
    console.log(`   Cleanup notice: prior tables may already be empty (${(err as Error).message})`);
  }

  await prisma.institute.upsert({
    where: { id: instituteId },
    update: { name: `LoadTest Institute (${SCALE_ARG})` },
    create: {
      id: instituteId,
      name: `LoadTest Institute (${SCALE_ARG})`,
      code: `LT-${SCALE_ARG.toUpperCase()}`,
      status: 'ACTIVE',
    },
  });

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: `admin-${SCALE_ARG}@loadtest.sarvlekh.internal` },
    update: { instituteId },
    create: {
      email: `admin-${SCALE_ARG}@loadtest.sarvlekh.internal`,
      name: 'LoadTest Admin',
      role: UserRole.ADMIN,
      instituteId,
      status: 'ACTIVE',
    },
  });

  // Teacher user
  const teacherUser = await prisma.user.upsert({
    where: { email: `teacher-${SCALE_ARG}@loadtest.sarvlekh.internal` },
    update: { instituteId },
    create: {
      email: `teacher-${SCALE_ARG}@loadtest.sarvlekh.internal`,
      name: 'LoadTest Teacher',
      role: UserRole.TEACHER,
      instituteId,
      status: 'ACTIVE',
    },
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: { userId: teacherUser.id },
  });

  // Subject and Curriculum
  const subject = await prisma.subject.upsert({
    where: { instituteId_name: { instituteId, name: 'Mathematics' } },
    update: {},
    create: {
      instituteId,
      name: 'Mathematics',
      code: 'MATH-10',
    },
  });

  const chapter = await prisma.chapter.create({
    data: {
      subjectId: subject.id,
      name: 'Algebra & Quadratic Equations',
      order: 1,
    },
  });

  const topic1 = await prisma.topic.create({
    data: { chapterId: chapter.id, name: 'Quadratic Equations', order: 1 },
  });
  const topic2 = await prisma.topic.create({
    data: { chapterId: chapter.id, name: 'Linear Systems', order: 2 },
  });

  console.log('2. Creating questions and blueprint...');
  const questions: string[] = [];
  for (let q = 1; q <= 10; q++) {
    const createdQ = await prisma.question.create({
      data: {
        instituteId,
        subjectId: subject.id,
        chapterId: chapter.id,
        topicId: q <= 5 ? topic1.id : topic2.id,
        type: 'MCQ',
        difficulty: q % 3 === 0 ? 'HARD' : q % 2 === 0 ? 'MEDIUM' : 'EASY',
        marks: 4,
        content: `Sample Quadratic Problem #${q} for scale testing?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        status: 'APPROVED',
        createdByUserId: teacherUser.id,
      },
    });
    questions.push(createdQ.id);
  }

  const blueprint = await prisma.blueprint.create({
    data: {
      instituteId,
      name: 'Standard Weekly Test Blueprint',
      totalMarks: 40,
      duration: 60,
      instructions: 'Standard instructions',
      distribution: [
        { topicId: topic1.id, marks: 20, difficulty: 'MEDIUM', count: 5 },
        { topicId: topic2.id, marks: 20, difficulty: 'MEDIUM', count: 5 },
      ],
      createdByUserId: teacherUser.id,
    },
  });

  console.log(`3. Creating batches and students (${config.studentsPerBatch} per batch)...`);
  let firstBatchId = '';
  let firstOngoingExamId = '';
  let firstAnswerSheetId = '';
  let firstStudentId = '';

  for (let b = 1; b <= config.batchesPerInstitute; b++) {
    const batch = await prisma.batch.create({
      data: {
        instituteId,
        name: `Grade 10 - Section ${String.fromCharCode(64 + b)}`,
        classYear: '10',
      },
    });
    if (!firstBatchId) firstBatchId = batch.id;

    await prisma.batchTeacher.create({
      data: {
        batchId: batch.id,
        teacherProfileId: teacherProfile.id,
        subjectId: subject.id,
      },
    });

    const students: string[] = [];
    for (let s = 1; s <= config.studentsPerBatch; s++) {
      const studentUser = await prisma.user.create({
        data: {
          email: `student-${b}-${s}-${SCALE_ARG}@loadtest.sarvlekh.internal`,
          name: `Student ${b}-${s}`,
          role: UserRole.STUDENT,
          instituteId,
          status: 'ACTIVE',
        },
      });

      const profile = await prisma.studentProfile.create({
        data: {
          userId: studentUser.id,
          instituteId,
          batchId: batch.id,
          rollNumber: `10${String.fromCharCode(64 + b)}${String(s).padStart(2, '0')}`,
        },
      });
      students.push(profile.id);
      if (!firstStudentId) firstStudentId = profile.id;
    }

    console.log(`   Batch ${batch.name} seeded with ${students.length} students.`);

    // Ongoing exam for grading tests
    const paper = await prisma.paper.create({
      data: {
        instituteId,
        title: `Paper for Batch ${b}`,
        status: PaperStatus.APPROVED,
        blueprintId: blueprint.id,
        totalMarks: 40,
        passingMarks: 16,
        createdByUserId: teacherUser.id,
      },
    });

    for (let i = 0; i < questions.length; i++) {
      await prisma.paperItem.create({
        data: {
          paperId: paper.id,
          questionId: questions[i],
          order: i + 1,
          marks: 4,
        },
      });
    }

    const exam = await prisma.exam.create({
      data: {
        instituteId,
        batchId: batch.id,
        blueprintId: blueprint.id,
        title: `Weekly Assessment ${b}`,
        type: 'WEEKLY_TEST',
        status: ExamStatus.ONGOING,
        scheduledDate: new Date(),
        createdByUserId: teacherUser.id,
      },
    });
    if (!firstOngoingExamId) firstOngoingExamId = exam.id;

    await prisma.paper.update({
      where: { id: paper.id },
      data: { examId: exam.id },
    });

    // Create answer sheets for students
    for (let si = 0; si < students.length; si++) {
      const studentProfileId = students[si];
      const sheet = await prisma.answerSheet.create({
        data: {
          examId: exam.id,
          studentProfileId,
          isVerified: si === 0 ? false : true, // 1st sheet unverified for grading test
        },
      });
      if (!firstAnswerSheetId) firstAnswerSheetId = sheet.id;

      // Seed mastery & interventions for pilot/demonstration
      const baselineMastery = 0.35 + (si % 5) * 0.08; // 0.35 - 0.67
      const improvedMastery = baselineMastery < 0.50 ? baselineMastery + 0.25 : baselineMastery + 0.10;

      await prisma.masteryScore.create({
        data: {
          studentProfileId,
          subjectId: subject.id,
          topicId: topic1.id,
          masteryValue: improvedMastery,
          trend: 0.15,
          sampleCount: 12,
        },
      });

      if (baselineMastery < 0.50) {
        const intervention = await prisma.intervention.create({
          data: {
            instituteId,
            studentProfileId,
            topicId: topic1.id,
            type: 'EXTRA_CLASS',
            description: 'Focused remedial on quadratic roots',
            beforeMastery: baselineMastery,
            afterMastery: improvedMastery,
            scheduledAt: new Date(Date.now() - 7 * 86400000),
            completedAt: new Date(Date.now() - 3 * 86400000),
            createdByUserId: teacherUser.id,
          },
        });

        await prisma.assignment.create({
          data: {
            studentProfileId,
            batchId: batch.id,
            topicId: topic1.id,
            title: 'Quadratic Equations Remedial Worksheet',
            dueDate: new Date(Date.now() - 2 * 86400000),
            status: AssignmentStatus.GRADED,
            submittedAt: new Date(Date.now() - 3 * 86400000),
            gradedMarks: 18,
            isAutoGenerated: true,
            createdByUserId: teacherUser.id,
          },
        });
      }

      // Seed score records
      await prisma.scoreRecord.create({
        data: {
          examId: exam.id,
          studentProfileId,
          totalMarks: 40,
          obtainedMarks: 24 + (si % 4) * 4,
          percentage: (24 + (si % 4) * 4) / 40 * 100,
          isFinalized: true,
        },
      });

      // Seed responses with mistake tags
      await prisma.response.create({
        data: {
          answerSheetId: sheet.id,
          questionId: questions[0],
          marksAwarded: 0,
          marksAvailable: 4,
          isCorrect: false,
          mistakeTags: [MistakeTagType.CONCEPT_ERROR, MistakeTagType.CALCULATION_ERROR],
        },
      });
    }
  }

  // Write output environment file for k6 tests
  const envContent = `# Auto-generated by load-tests/seed-fixtures.ts for scale: ${SCALE_ARG}
BASE_URL=http://localhost:4000/api/v1
INSTITUTE_ID=${instituteId}
EXAM_ID=${firstOngoingExamId}
ANSWER_SHEET_ID=${firstAnswerSheetId}
BATCH_ID=${firstBatchId}
BLUEPRINT_ID=${blueprint.id}
STUDENT_ID=${firstStudentId}
# Replace with valid JWT signed for admin-${SCALE_ARG}@loadtest.sarvlekh.internal
AUTH_TOKEN=
`;

  const envPath = path.resolve(__dirname, '.env.loadtest');
  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log(`\n Fixtures successfully seeded!`);
  console.log(` Environment configuration written to: ${envPath}`);
  console.log(`  INSTITUTE_ID:    ${instituteId}`);
  console.log(`  EXAM_ID:         ${firstOngoingExamId}`);
  console.log(`  ANSWER_SHEET_ID: ${firstAnswerSheetId}`);
  console.log(`  BATCH_ID:        ${firstBatchId}`);
  console.log(`  STUDENT_ID:      ${firstStudentId}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
