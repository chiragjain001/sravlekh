const { PrismaClient } = require('../packages/db/node_modules/@prisma/client');
const net = require('net');
const { performance } = require('perf_hooks');

const rawUrl = process.env.DATABASE_URL || 'postgresql://postgres.yfybufxsjjodjjwupjzv:Chirag%409588@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const parsedUrl = new URL(rawUrl);

console.log('====================================================');
console.log('AIOS DEEP DATABASE BENCHMARK & EXPLAIN ANALYZE');
console.log('====================================================');

function createPrismaWithPool(limit) {
  const urlWithPool = new URL(rawUrl);
  urlWithPool.searchParams.set('connection_limit', String(limit));
  urlWithPool.searchParams.set('pool_timeout', '20');
  return new PrismaClient({
    datasources: {
      db: { url: urlWithPool.toString() }
    }
  });
}

async function explainAnalyzeQueries() {
  console.log('\n--- 1. EXPLAIN (ANALYZE, BUFFERS) on Key Production Queries ---');
  const prisma = createPrismaWithPool(5);
  await prisma.$connect();

  const queries = [
    {
      name: 'Questions query by Institute & Subject (Question Bank)',
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT id, content, type, difficulty, "subjectId", "instituteId" FROM questions WHERE "instituteId" = 'demo-institute-1' ORDER BY "createdAt" DESC LIMIT 20;`
    },
    {
      name: 'Student Profiles query with Batch join (Student Management)',
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT sp.id, sp."rollNumber", u.name, u.email, b.name as batch_name FROM student_profiles sp JOIN users u ON sp."userId" = u.id LEFT JOIN batches b ON sp."batchId" = b.id WHERE sp."instituteId" = 'demo-institute-1' ORDER BY u.name ASC LIMIT 10;`
    },
    {
      name: 'Batches list with Student Profile count (Batch Management)',
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT b.id, b.name, b."classYear", b.section, COUNT(sp.id) as student_count FROM batches b LEFT JOIN student_profiles sp ON sp."batchId" = b.id WHERE b."instituteId" = 'demo-institute-1' GROUP BY b.id, b.name, b."classYear", b.section;`
    },
    {
      name: 'Audit Logs pagination query (Admin Audit Log)',
      sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT id, action, entity, "actorId", "createdAt" FROM audit_logs WHERE "instituteId" = 'demo-institute-1' ORDER BY "createdAt" DESC LIMIT 6;`
    }
  ];

  for (const q of queries) {
    console.log(`\n>>> EXPLAIN: ${q.name}`);
    try {
      const result = await prisma.$queryRawUnsafe(q.sql);
      const plan = result.map(r => r['QUERY PLAN']).join('\n');
      console.log(plan);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }

  await prisma.$disconnect();
  await new Promise(r => setTimeout(r, 500));
}

async function measureQueryVsPrismaOverhead() {
  console.log('\n--- 2. Query Execution vs Prisma ORM Processing Overhead ---');
  const prisma = createPrismaWithPool(5);
  await prisma.$connect();

  // Test 1: Raw SQL SELECT 1
  const t0 = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const rawSelect1 = performance.now() - t0;

  // Test 2: Raw SQL vs Prisma findMany on Questions
  const t1 = performance.now();
  await prisma.$queryRawUnsafe(`SELECT id, content, type, difficulty, "subjectId" FROM questions WHERE "instituteId" = 'demo-institute-1' LIMIT 20`);
  const rawQuestions = performance.now() - t1;

  const t2 = performance.now();
  await prisma.question.findMany({
    where: { instituteId: 'demo-institute-1' },
    select: { id: true, content: true, type: true, difficulty: true, subjectId: true },
    take: 20
  });
  const prismaQuestions = performance.now() - t2;

  // Test 3: Raw SQL vs Prisma findMany on StudentProfiles with user include
  const t3 = performance.now();
  await prisma.$queryRawUnsafe(`SELECT sp.id, sp."rollNumber", u.name, u.email FROM student_profiles sp JOIN users u ON sp."userId" = u.id WHERE sp."instituteId" = 'demo-institute-1' LIMIT 10`);
  const rawStudents = performance.now() - t3;

  const t4 = performance.now();
  await prisma.studentProfile.findMany({
    where: { instituteId: 'demo-institute-1' },
    include: { user: true },
    take: 10
  });
  const prismaStudents = performance.now() - t4;

  console.log(`  SELECT 1 Wire Roundtrip: ${rawSelect1.toFixed(2)} ms`);
  console.log(`  Questions (20 rows) - Raw SQL: ${rawQuestions.toFixed(2)} ms | Prisma ORM: ${prismaQuestions.toFixed(2)} ms | ORM overhead: ${(prismaQuestions - rawQuestions).toFixed(2)} ms`);
  console.log(`  Students + User (10 rows) - Raw SQL: ${rawStudents.toFixed(2)} ms | Prisma ORM: ${prismaStudents.toFixed(2)} ms | ORM overhead: ${(prismaStudents - rawStudents).toFixed(2)} ms`);

  await prisma.$disconnect();
}

async function calculateTotalConnections() {
  console.log('\n--- 3. Total Database Connections Sizing Model ---');
  console.log('Postgres Default max_connections: 100 (or Supabase PgBouncer pool default: 15-25 direct / 200 transaction pooler)');
  console.log('Formula: Total Connections = (API_Instances * DATABASE_POOL_LIMIT) + (Worker_Instances * WORKER_POOL_LIMIT) + Monitoring');
  
  const scenarios = [
    { name: 'Current Single Dev Node', apiInstances: 1, poolLimit: 5, workers: 1, workerPool: 2 },
    { name: 'Production Baseline (2 API replicas, 1 Worker)', apiInstances: 2, poolLimit: 10, workers: 1, workerPool: 5 },
    { name: 'Production High-Availability (3 API replicas, 2 Workers)', apiInstances: 3, poolLimit: 15, workers: 2, workerPool: 5 },
    { name: 'Peak Burst Scaling (5 API replicas, 3 Workers)', apiInstances: 5, poolLimit: 15, workers: 3, workerPool: 5 },
    { name: 'Danger Sizing (5 API replicas, default num_cpus*2+1 = 17)', apiInstances: 5, poolLimit: 17, workers: 3, workerPool: 10 }
  ];

  for (const s of scenarios) {
    const total = (s.apiInstances * s.poolLimit) + (s.workers * s.workerPool) + 3; // +3 for health/admin
    const status = total > 100 ? 'CRITICAL EXCEED (>100)' : total > 80 ? 'WARNING (>80%)' : 'SAFE (<80%)';
    console.log(`  - ${s.name.padEnd(55)}: ${total} connections [${status}]`);
  }
}

async function run() {
  await explainAnalyzeQueries();
  await measureQueryVsPrismaOverhead();
  await calculateTotalConnections();
}

run().catch(console.error);
