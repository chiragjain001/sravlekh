const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const indexNames = [
    'assignments_studentProfileId_idx',
    'interventions_instituteId_idx',
    'answer_sheets_studentProfileId_idx',
    'responses_questionId_idx'
  ];

  console.log('Checking existence of scalability indexes in PostgreSQL pg_indexes:');
  for (const name of indexNames) {
    const res = await prisma.$queryRawUnsafe(`SELECT indexname, tablename FROM pg_indexes WHERE indexname = '${name}';`);
    if (res.length > 0) {
      console.log(`  [EXISTS] ${name} on table ${res[0].tablename}`);
    } else {
      console.log(`  [MISSING] ${name}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
