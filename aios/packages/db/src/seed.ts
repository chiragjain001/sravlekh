import { PrismaClient, InstitutePlan, InstituteStatus, UserRole, QuestionType, DifficultyLevel } from '@prisma/client';

const prisma = new PrismaClient();

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

  // 2. Allowlist entry for local testing (so anyone logging in gets FOUNDER)
  // Usually you'd restrict this to a specific email.
  await prisma.allowListEntry.upsert({
    where: {
      instituteId_email: {
        instituteId: institute.id,
        email: 'test@example.com', // Change this to your Google email if needed
      }
    },
    update: {},
    create: {
      instituteId: institute.id,
      email: 'test@example.com',
      role: UserRole.FOUNDER,
    }
  });

  // 3. Create Curriculum (Subject -> Chapter -> Topic)
  const subject = await prisma.subject.upsert({
    where: { instituteId_name: { instituteId: institute.id, name: 'Physics' } },
    update: {},
    create: {
      instituteId: institute.id,
      name: 'Physics',
      code: 'PHY101',
    },
  });

  const chapter = await prisma.chapter.create({
    data: {
      subjectId: subject.id,
      name: 'Kinematics',
      order: 1,
    }
  });

  const topic1 = await prisma.topic.create({
    data: {
      chapterId: chapter.id,
      name: 'Motion in a Straight Line',
      order: 1,
    }
  });
  
  const topic2 = await prisma.topic.create({
    data: {
      chapterId: chapter.id,
      name: 'Projectile Motion',
      order: 2,
    }
  });
  console.log(`✅ Curriculum created: ${subject.name} -> ${chapter.name}`);

  // 4. Create a Batch
  const batch = await prisma.batch.create({
    data: {
      instituteId: institute.id,
      name: 'JEE Mains 2026 - Batch Alpha',
      classYear: 'Class 11',
      section: 'A',
    }
  });
  console.log(`✅ Batch created: ${batch.name}`);

  // 5. Create some Questions
  const mockUserId = 'seeder-user-id'; // Normally would be a real user's ID
  
  await prisma.question.create({
    data: {
      instituteId: institute.id,
      subjectId: subject.id,
      chapterId: chapter.id,
      topicId: topic1.id,
      type: QuestionType.MCQ,
      difficulty: DifficultyLevel.EASY,
      marks: 4,
      negativeMarks: 1,
      content: 'A car accelerates from rest at 2 m/s². What is its velocity after 5 seconds?',
      options: [
        { label: 'A', text: '5 m/s', isCorrect: false },
        { label: 'B', text: '10 m/s', isCorrect: true },
        { label: 'C', text: '15 m/s', isCorrect: false },
        { label: 'D', text: '20 m/s', isCorrect: false },
      ],
      solution: 'v = u + at = 0 + (2)(5) = 10 m/s',
      isApproved: true,
      createdByUserId: mockUserId,
    }
  });

  await prisma.question.create({
    data: {
      instituteId: institute.id,
      subjectId: subject.id,
      chapterId: chapter.id,
      topicId: topic2.id,
      type: QuestionType.MCQ,
      difficulty: DifficultyLevel.MEDIUM,
      marks: 4,
      negativeMarks: 1,
      content: 'A projectile is fired at an angle of 45°. If the initial velocity is 20 m/s, what is the maximum height? (g = 10 m/s²)',
      options: [
        { label: 'A', text: '10 m', isCorrect: true },
        { label: 'B', text: '20 m', isCorrect: false },
        { label: 'C', text: '5 m', isCorrect: false },
        { label: 'D', text: '40 m', isCorrect: false },
      ],
      solution: 'H = (u² sin²θ) / 2g = (400 * 0.5) / 20 = 10 m',
      isApproved: true,
      createdByUserId: mockUserId,
    }
  });
  console.log(`✅ Question Bank seeded.`);

  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
