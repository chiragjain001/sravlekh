import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Rebuilds the demo institute into the exact school the user asked for:
// Classes 10/11/12, 3 sections each (A/B/C) = 9 batches, exactly 3 subjects
// (Mathematics, Physics, Chemistry — those curricula already exist from
// earlier seeds and are kept as-is), 3 subject teachers who each teach their
// subject to all three classes (all 9 sections) plus 2 spare teachers with no
// class of their own, and exactly 100 students spread across the 9 sections.
//
// This SUPERSEDES the previous version of this script (which built JEE/NEET
// batches + a Biology subject — not what was asked for). Safe to re-run:
// it tears down everything it doesn't want under this institute and rebuilds
// fresh each time, while keeping the 4 mock role users so dev-login keeps
// working, and keeping the Physics/Chemistry/Mathematics curricula (real
// chapters/topics/question banks) so the Assessment Builder still has real
// data to draw from.

const INSTITUTE_ID = 'demo-institute-1';
const CLASSES = ['10', '11', '12'] as const;
const SECTIONS = ['A', 'B', 'C'] as const;
const SUBJECT_NAMES = ['Mathematics', 'Physics', 'Chemistry'] as const;

const FIRST_NAMES = [
  'Aditi', 'Rohan', 'Kavya', 'Vikram', 'Ishita', 'Arjun', 'Meera', 'Karan',
  'Ananya', 'Siddharth', 'Pooja', 'Rahul', 'Divya', 'Nikhil', 'Sneha', 'Amit',
  'Riya', 'Varun', 'Neha', 'Aryan', 'Tanvi', 'Rajat', 'Simran', 'Yash',
  'Priyanka', 'Manav', 'Shreya', 'Dev', 'Isha', 'Kabir', 'Zara', 'Aarav',
];
const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Gupta', 'Iyer', 'Menon', 'Chauhan', 'Bhatt',
  'Joshi', 'Kapoor', 'Verma', 'Nair', 'Rao', 'Singh', 'Desai',
];

function studentName(i: number): string {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
}

// The Supabase pooler routinely refuses the first connection (project waking
// from idle) and accepts on a retry a second later. Without this the whole
// seed aborts on a cold start.
async function connectWithRetry(attempts = 5): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`   …database not reachable yet (attempt ${i}/${attempts}), retrying in 3s`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function upsertTeacher(opts: { userId: string; email: string; name: string; googleSub: string; qualification: string }) {
  const user = await prisma.user.upsert({
    where: { instituteId_email: { instituteId: INSTITUTE_ID, email: opts.email } },
    update: { name: opts.name },
    create: {
      id: opts.userId,
      instituteId: INSTITUTE_ID,
      email: opts.email,
      name: opts.name,
      googleSub: opts.googleSub,
      role: UserRole.TEACHER,
      status: 'ACTIVE',
    },
  });
  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, qualification: opts.qualification },
  });
  return { user, teacherProfile };
}

async function main() {
  console.log('🏫 Rebuilding demo school: Classes 10/11/12 x Sections A/B/C, subjects Mathematics/Physics/Chemistry, 100 students...');
  await connectWithRetry();

  const institute = await prisma.institute.findUnique({ where: { id: INSTITUTE_ID } });
  if (!institute) throw new Error(`Institute ${INSTITUTE_ID} not found — run "pnpm --filter @aios/db seed" first.`);

  const mockTeacherUser = await prisma.user.findUniqueOrThrow({
    where: { instituteId_email: { instituteId: INSTITUTE_ID, email: 'mock-teacher@aios.dev' } },
  });
  const mockStudentUser = await prisma.user.findUniqueOrThrow({
    where: { instituteId_email: { instituteId: INSTITUTE_ID, email: 'mock-student@aios.dev' } },
  });

  // ── 1. Tear down the old, mismatched structure ─────────────────────────
  const oldBatches = await prisma.batch.findMany({ where: { instituteId: INSTITUTE_ID } });
  const oldBatchIds = oldBatches.map((b) => b.id);

  if (oldBatchIds.length) {
    await prisma.assignment.deleteMany({ where: { batchId: { in: oldBatchIds } } });
  }
  // Assessment cascades AssessmentDelivery -> Attempt/DocumentBundle, so this
  // one delete clears an old test fixture that was still pinning demo-batch-jee-alpha.
  await prisma.assessment.deleteMany({ where: { instituteId: INSTITUTE_ID } });
  await prisma.paper.deleteMany({ where: { instituteId: INSTITUTE_ID } });
  await prisma.exam.deleteMany({ where: { instituteId: INSTITUTE_ID } });
  await prisma.blueprint.deleteMany({ where: { instituteId: INSTITUTE_ID } });

  const oldStudentUserIds = (await prisma.user.findMany({
    where: { instituteId: INSTITUTE_ID, role: UserRole.STUDENT, NOT: { id: mockStudentUser.id } },
    select: { id: true },
  })).map((u) => u.id);
  if (oldStudentUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: oldStudentUserIds } } }); // cascades StudentProfile
  }
  // Clear the mock student's old batch link — the FK would otherwise block
  // deleting the old batch below.
  await prisma.studentProfile.updateMany({ where: { userId: mockStudentUser.id }, data: { batchId: null } });

  const biology = await prisma.subject.findUnique({
    where: { instituteId_name: { instituteId: INSTITUTE_ID, name: 'Biology' } },
  });
  if (biology) {
    // Question doesn't cascade from Subject/Chapter/Topic (only from
    // Institute directly), so its rows must go before the subject does.
    await prisma.question.deleteMany({ where: { subjectId: biology.id } });
    await prisma.subject.delete({ where: { id: biology.id } }); // cascades Chapter -> Topic
  }

  const oldTeacherUserIds = (await prisma.user.findMany({
    where: { instituteId: INSTITUTE_ID, role: UserRole.TEACHER, NOT: { id: mockTeacherUser.id } },
    select: { id: true },
  })).map((u) => u.id);
  if (oldTeacherUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: oldTeacherUserIds } } }); // cascades TeacherProfile -> BatchTeacher
  }

  if (oldBatchIds.length) {
    await prisma.batch.deleteMany({ where: { id: { in: oldBatchIds } } }); // cascades any remaining BatchTeacher
  }
  console.log('🧹 Old batches, Biology subject, and non-mock teachers/students cleared.');

  // ── 2. Subjects — Mathematics/Physics/Chemistry already exist with real
  //      chapters/topics/question banks from earlier seeds; reuse them as-is.
  const subjects = {} as Record<(typeof SUBJECT_NAMES)[number], { id: string; name: string }>;
  for (const name of SUBJECT_NAMES) {
    subjects[name] = await prisma.subject.findUniqueOrThrow({
      where: { instituteId_name: { instituteId: INSTITUTE_ID, name } },
    });
  }
  console.log(`✅ Reusing existing subjects: ${SUBJECT_NAMES.join(', ')}.`);

  // ── 3. Nine batches: Class 10/11/12 x Section A/B/C ────────────────────
  const sections: { cls: string; section: string; batch: { id: string } }[] = [];
  for (const cls of CLASSES) {
    for (const section of SECTIONS) {
      const batch = await prisma.batch.upsert({
        where: { id: `school-batch-c${cls}-${section.toLowerCase()}` },
        update: {},
        create: {
          id: `school-batch-c${cls}-${section.toLowerCase()}`,
          instituteId: INSTITUTE_ID,
          name: `Class ${cls} - Section ${section}`,
          classYear: `Class ${cls}`,
          section,
        },
      });
      sections.push({ cls, section, batch });
    }
  }
  console.log('✅ 9 batches created: Class 10/11/12 x Section A/B/C.');

  // ── 4. Five teachers: one per subject, each teaching that subject to all
  //      three classes (all 9 sections), plus 2 spare teachers who have a
  //      subject specialisation but no class of their own yet.
  type TeacherSlot = { subject: (typeof SUBJECT_NAMES)[number]; user: { id: string; name: string }; teacherProfile: { id: string } };
  const classTeachers: TeacherSlot[] = [];

  const { teacherProfile: rahulProfile } = await upsertTeacher({
    userId: mockTeacherUser.id,
    email: mockTeacherUser.email,
    name: mockTeacherUser.name,
    googleSub: 'mock_teacher_seed',
    qualification: 'M.Sc Physics, IIT Bombay',
  });
  classTeachers.push({ subject: 'Physics', user: mockTeacherUser, teacherProfile: rahulProfile });

  const { user: priyaUser, teacherProfile: priyaProfile } = await upsertTeacher({
    userId: 'school-teacher-chemistry',
    email: 'priya.nair@apex-demo.aios.dev',
    name: 'Priya Nair',
    googleSub: 'school_teacher_priya',
    qualification: 'M.Sc Chemistry, Delhi University',
  });
  classTeachers.push({ subject: 'Chemistry', user: priyaUser, teacherProfile: priyaProfile });

  const { user: anilUser, teacherProfile: anilProfile } = await upsertTeacher({
    userId: 'school-teacher-mathematics',
    email: 'anil.kumar@apex-demo.aios.dev',
    name: 'Anil Kumar',
    googleSub: 'school_teacher_anil',
    qualification: 'M.Sc Mathematics, IIT Delhi',
  });
  classTeachers.push({ subject: 'Mathematics', user: anilUser, teacherProfile: anilProfile });

  // Spare teachers — on the roster with a subject, deliberately not assigned
  // to any batch, so the Admin roster shows real "available capacity".
  const SPARE_TEACHERS: { subject: (typeof SUBJECT_NAMES)[number]; name: string; qualification: string }[] = [
    { subject: 'Mathematics', name: 'Kavita Menon', qualification: 'M.Sc Mathematics, BHU' },
    { subject: 'Physics', name: 'Sunita Rao', qualification: 'M.Sc Physics, Anna University' },
  ];
  const spareTeachers: TeacherSlot[] = [];
  for (const t of SPARE_TEACHERS) {
    const slug = t.name.toLowerCase().replace(/\s+/g, '-');
    const { user, teacherProfile } = await upsertTeacher({
      userId: `school-teacher-spare-${slug}`,
      email: `${t.name.toLowerCase().replace(/\s+/g, '.')}@apex-demo.aios.dev`,
      name: t.name,
      googleSub: `school_teacher_spare_${slug.replace(/-/g, '_')}`,
      qualification: t.qualification,
    });
    spareTeachers.push({ subject: t.subject, user, teacherProfile });
  }
  console.log(`✅ 5 teachers ready — 3 class teachers (${classTeachers.map((t) => `${t.user.name}/${t.subject}`).join(', ')}) + 2 spare (${spareTeachers.map((t) => t.user.name).join(', ')}).`);

  // TeacherProfile.subjectIds is the denormalized field the Admin dashboard's
  // "unassigned to a subject" pending-action check reads — separate from the
  // BatchTeacher join used by the paper builder. Keep both in sync.
  for (const slot of [...classTeachers, ...spareTeachers]) {
    await prisma.teacherProfile.update({
      where: { id: slot.teacherProfile.id },
      data: { subjectIds: { set: [subjects[slot.subject].id] } },
    });
  }

  // ── 5. BatchTeacher assignments — each of the 3 class teachers covers all
  //      9 sections for their subject (27 rows). Spares get none.
  let assignmentsCreated = 0;
  for (const slot of classTeachers) {
    for (const { batch } of sections) {
      const existing = await prisma.batchTeacher.findFirst({
        where: { batchId: batch.id, teacherProfileId: slot.teacherProfile.id, subjectId: subjects[slot.subject].id },
      });
      if (!existing) {
        await prisma.batchTeacher.create({
          data: { batchId: batch.id, teacherProfileId: slot.teacherProfile.id, subjectId: subjects[slot.subject].id },
        });
        assignmentsCreated += 1;
      }
    }
  }
  console.log(`✅ ${assignmentsCreated} batch-teacher-subject assignments created.`);

  // ── 6. 100 students across the 9 sections (11 each, 12 in Class 11 - A,
  //      which is where the mock student/teacher live).
  let nameIdx = 0;
  let studentsCreated = 0;
  let mockStudentPlaced = false;

  for (const { cls, section, batch } of sections) {
    const isMockStudentSection = cls === '11' && section === 'A';
    const count = isMockStudentSection ? 12 : 11;

    for (let i = 1; i <= count; i++) {
      const rollNumber = `C${cls}${section}-${String(i).padStart(3, '0')}`;

      // Fold the mock student in as the first seat of Class 11 - Section A
      // so dev-login STUDENT lands in a real, matching section.
      if (isMockStudentSection && i === 1) {
        await prisma.studentProfile.update({
          where: { userId: mockStudentUser.id },
          data: { batchId: batch.id, rollNumber },
        });
        mockStudentPlaced = true;
        continue;
      }

      const name = studentName(nameIdx);
      nameIdx += 1;
      const slug = `c${cls}-${section.toLowerCase()}-${i}`;
      const email = `student.${slug}@apex-demo.aios.dev`;

      const user = await prisma.user.upsert({
        where: { instituteId_email: { instituteId: INSTITUTE_ID, email } },
        update: {},
        create: {
          id: `school-student-${slug}`,
          instituteId: INSTITUTE_ID,
          email,
          name,
          googleSub: `school_student_${slug.replace(/-/g, '_')}`,
          role: UserRole.STUDENT,
          status: 'ACTIVE',
        },
      });
      const existingProfile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
      if (!existingProfile) {
        await prisma.studentProfile.create({ data: { userId: user.id, rollNumber, batchId: batch.id, tags: [] } });
        studentsCreated += 1;
      } else {
        await prisma.studentProfile.update({ where: { userId: user.id }, data: { batchId: batch.id, rollNumber } });
      }
    }
  }
  const total = studentsCreated + (mockStudentPlaced ? 1 : 0);
  console.log(`✅ ${total} students placed across 9 sections (${studentsCreated} new + mock student).`);

  console.log('✨ Demo school rebuild complete!');
  console.log('   3 classes (10/11/12) x 3 sections (A/B/C) = 9 batches · 3 subjects (Mathematics, Physics, Chemistry) · 5 teachers (3 teaching all 9 sections + 2 spare) · 100 students total.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1; // let .finally() below actually run and release the pooled connection
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
