import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function calculatePercentiles(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const median = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  return { min, median, p90, p95, p99, max, avg };
}

async function main() {
  console.log('====================================================================');
  console.log('SARVLEKH SAAS PERFORMANCE & DATABASE ARCHITECT AUDIT');
  console.log('====================================================================\n');

  // --- SECTION 1: NETWORK LATENCY & REGION AUDIT (PHASE 8) ---
  console.log('--- 1. Database Network Latency & RTT Audit (Phase 8) ---');
  // Warmup
  await prisma.$queryRawUnsafe('SELECT 1');

  const rttRuns: number[] = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    const t1 = performance.now();
    rttRuns.push(t1 - t0);
  }
  const rttStats = calculatePercentiles(rttRuns);
  console.log('Ping / Round-Trip Latency (30 runs of SELECT 1):');
  console.log(`  Min:    ${rttStats.min.toFixed(2)} ms`);
  console.log(`  Median: ${rttStats.median.toFixed(2)} ms`);
  console.log(`  p95:    ${rttStats.p95.toFixed(2)} ms`);
  console.log(`  p99:    ${rttStats.p99.toFixed(2)} ms`);
  console.log(`  Avg:    ${rttStats.avg.toFixed(2)} ms`);

  // --- SECTION 2: PG_STAT_STATEMENTS & SYSTEM EXTENSIONS (PHASE 4) ---
  console.log('\n--- 2. Checking PostgreSQL Extensions (pg_stat_statements) ---');
  try {
    const extRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_stat_statements';
    `);
    if (extRes.length > 0) {
      console.log(`  pg_stat_statements: INSTALLED (v${extRes[0].extversion})`);
      const topQueries: any[] = await prisma.$queryRawUnsafe(`
        SELECT
          query,
          calls,
          ROUND(total_exec_time::numeric, 2) AS total_ms,
          ROUND(mean_exec_time::numeric, 2) AS mean_ms,
          rows
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 5;
      `);
      console.log('  Top 5 queries by total execution time:');
      console.table(topQueries);
    } else {
      console.log('  pg_stat_statements: NOT INSTALLED in current database schema.');
    }
  } catch (err: any) {
    console.log('  pg_stat_statements query notice:', err.message);
  }

  // --- SECTION 3: INDEX USAGE & SIZE AUDIT (PHASE 6 & 7) ---
  console.log('\n--- 3. Database Index Catalog, Sizes & Usage Stats (Phase 6 & 7) ---');
  const indexStats: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      relname AS table_name,
      indexrelname AS index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
      pg_relation_size(indexrelid) AS size_bytes,
      idx_scan AS index_scans,
      idx_tup_read AS tuples_read,
      idx_tup_fetch AS tuples_fetched
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND relname IN ('responses', 'score_records', 'student_profiles', 'mastery_scores', 'questions', 'assignments', 'answer_sheets')
    ORDER BY pg_relation_size(indexrelid) DESC;
  `);
  console.table(indexStats.map((r: any) => ({
    Table: r.table_name,
    Index: r.index_name,
    Size: r.index_size,
    Scans: Number(r.index_scans),
    TuplesRead: Number(r.tuples_read),
  })));

  // --- SECTION 4: GIN INDEX SPECIFIC AUDIT ON responses_mistakeTags_gin_idx ---
  console.log('\n--- 4. Specific GIN Index Behavior Audit on responses_mistakeTags_gin_idx ---');
  // Plan 1: Query with cardinality > 0 and unnest (current getBatchMistakeSummary)
  console.log('Testing Plan 1: Current getBatchMistakeSummary pattern (cardinality > 0 + LATERAL unnest):');
  const explainPlan1: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
    SELECT
      r."questionId",
      tag.value::text AS tag,
      COUNT(*) AS cnt
    FROM responses r
    CROSS JOIN LATERAL unnest(r."mistakeTags") AS tag(value)
    WHERE cardinality(r."mistakeTags") > 0
    GROUP BY r."questionId", tag.value;
  `);
  console.log(explainPlan1.map((r: any) => r['QUERY PLAN']).join('\n'));

  // Plan 2: Array containment query that CAN use GIN index
  console.log('\nTesting Plan 2: GIN-compatible query (mistakeTags && ARRAY["CONCEPT_ERROR"]::"MistakeTagType"[]):');
  try {
    const explainPlan2: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS)
      SELECT id, "questionId", "marksAwarded"
      FROM responses
      WHERE "mistakeTags" && ARRAY['CONCEPT_ERROR']::"MistakeTagType"[];
    `);
    console.log(explainPlan2.map((r: any) => r['QUERY PLAN']).join('\n'));
  } catch (e: any) {
    console.log('Note on GIN plan 2:', e.message);
  }

  // --- SECTION 5: COVERING INDEX EVALUATION (PHASE 7) ---
  console.log('\n--- 5. Testing Index-Only / Covering Scan with INCLUDE (Phase 7) ---');
  // Example candidate: student_profiles query by batchId needing id, rollNumber, userId
  const explainStudentBatch: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
    SELECT id, "userId", "rollNumber"
    FROM student_profiles
    WHERE "batchId" = 'batch-1';
  `);
  console.log(explainStudentBatch.map((r: any) => r['QUERY PLAN']).join('\n'));

  // --- SECTION 6: TABLE ROW COUNTS & SIZES ---
  console.log('\n--- 6. Table Row Counts and Heap Sizes ---');
  const tableStats: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      relname AS table_name,
      n_live_tup AS estimated_rows,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_size_pretty(pg_relation_size(relid)) AS heap_size,
      pg_size_pretty(pg_indexes_size(relid)) AS index_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 15;
  `);
  console.table(tableStats);

  console.log('\n====================================================================');
  console.log('AUDIT COMPLETED SUCCESSFULLY');
  console.log('====================================================================');
}

main()
  .catch((err) => {
    console.error('Audit run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
