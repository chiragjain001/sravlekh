const { PrismaClient } = require('../packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sql = `EXPLAIN (ANALYZE, BUFFERS) SELECT id, content, type, difficulty, "subjectId", "instituteId" FROM questions WHERE "instituteId" = 'demo-institute-1' ORDER BY "createdAt" DESC LIMIT 20;`;
  console.log('Query: ' + sql);
  const result = await prisma.$queryRawUnsafe(sql);
  console.log('\n--- QUERY PLAN ---');
  console.log(result.map(r => r['QUERY PLAN']).join('\n'));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
