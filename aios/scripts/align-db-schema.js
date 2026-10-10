const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Checking enums...');
  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typname = 'BloomsTaxonomyLevel';
  `);
  console.log('Enum:', enums);

  if (enums.length === 0) {
    console.log('Creating BloomsTaxonomyLevel enum...');
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "BloomsTaxonomyLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');
    `);
  }

  console.log('Checking questions.bloomsLevel column...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "bloomsLevel" "BloomsTaxonomyLevel" NOT NULL DEFAULT 'UNDERSTAND';
  `);

  console.log('Checking paper_items.bloomsLevel column...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "paper_items" ADD COLUMN IF NOT EXISTS "bloomsLevel" "BloomsTaxonomyLevel" NOT NULL DEFAULT 'APPLY';
  `);

  console.log('Successfully aligned database columns!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
