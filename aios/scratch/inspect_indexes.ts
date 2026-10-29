import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const indexes: any = await prisma.$queryRaw`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('users', 'batch_enrollments')
    ORDER BY tablename, indexname;
  `;
  console.log(JSON.stringify(indexes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
