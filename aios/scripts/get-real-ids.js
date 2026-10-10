const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.subject.findFirst({
    where: { instituteId: 'demo-institute-1' },
    include: { chapters: { include: { topics: true } } }
  });
  const b = await prisma.batch.findFirst({ where: { instituteId: 'demo-institute-1' } });
  const st = await prisma.studentProfile.findFirst({ where: { instituteId: 'demo-institute-1' } });

  console.log('Real Hierarchy IDs:', {
    subjectId: s?.id,
    chapterId: s?.chapters[0]?.id,
    topicId: s?.chapters[0]?.topics[0]?.id,
    batchId: b?.id,
    studentProfileId: st?.id
  });
}

main().finally(() => prisma.$disconnect());
