const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const institutes = await prisma.institute.findMany({
    select: { id: true, name: true, plan: true, status: true, _count: { select: { users: true, batches: true, questions: true } } }
  });
  console.log('Found institutes:', JSON.stringify(institutes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
