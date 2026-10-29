import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const insts = await prisma.institute.findMany({
    select: { id: true, name: true, shortCode: true, status: true },
  });
  console.log('INSTITUTES:', JSON.stringify(insts, null, 2));

  const userCounts = await prisma.user.groupBy({
    by: ['role'],
    _count: { id: true },
  });
  console.log('USERS BY ROLE:', JSON.stringify(userCounts, null, 2));

  const batches = await prisma.batch.count();
  const exams = await prisma.exam.count();
  const questions = await prisma.question.count();
  console.log({ batches, exams, questions });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
