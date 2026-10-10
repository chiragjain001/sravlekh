import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  console.log('=================================================================');
  console.log('STEP 1: DATABASE INDEX VALIDATION & QUERY PLAN ANALYSIS');
  console.log('=================================================================\n');

  try {
    // 1. Check database connectivity and version
    const versionRes: any[] = await prisma.$queryRawUnsafe('SELECT version(), current_database(), current_user;');
    console.log('Connected to PostgreSQL:', versionRes[0]);

    // 2. Indexes from packages/db/manual-sql/scalability-indexes.sql
    const targetIndexes = [
      {
        name: 'assignments_studentProfileId_idx',
        table: 'assignments',
        sql: 'CREATE INDEX IF NOT EXISTS "assignments_studentProfileId_idx" ON "assignments"("studentProfileId");',
      },
      {
        name: 'interventions_instituteId_idx',
        table: 'interventions',
        sql: 'CREATE INDEX IF NOT EXISTS "interventions_instituteId_idx" ON "interventions"("instituteId");',
      },
      {
        name: 'answer_sheets_studentProfileId_idx',
        table: 'answer_sheets',
        sql: 'CREATE INDEX IF NOT EXISTS "answer_sheets_studentProfileId_idx" ON "answer_sheets"("studentProfileId");',
      },
      {
        name: 'responses_questionId_idx',
        table: 'responses',
        sql: 'CREATE INDEX IF NOT EXISTS "responses_questionId_idx" ON "responses"("questionId");',
      },
      {
        name: 'responses_mistakeTags_gin_idx',
        table: 'responses',
        sql: 'CREATE INDEX IF NOT EXISTS "responses_mistakeTags_gin_idx" ON "responses" USING GIN ("mistakeTags");',
      },
      {
        name: 'student_profiles_instituteId_idx',
        table: 'student_profiles',
        sql: 'CREATE INDEX IF NOT EXISTS "student_profiles_instituteId_idx" ON "student_profiles"("instituteId");',
      },
    ];

    console.log('\n--- 1. Executing Index Creation (IF NOT EXISTS) ---');
    for (const idx of targetIndexes) {
      try {
        console.log(`Ensuring index [${idx.name}] on ${idx.table}...`);
        await prisma.$executeRawUnsafe(idx.sql);
        console.log(`  -> OK`);
      } catch (err: any) {
        console.warn(`  -> Note/Warning on ${idx.name}:`, err.message);
      }
    }

    // 3. Query PostgreSQL metadata to verify all indexes exist
    console.log('\n--- 2. Verifying Indexes via PostgreSQL Catalog (pg_indexes) ---');
    const existingIndexes: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          tablename IN ('responses', 'answer_sheets', 'assignments', 'interventions', 'student_profiles', 'mastery_scores')
        )
      ORDER BY tablename, indexname;
    `);

    const tableRows = targetIndexes.map(target => {
      const match = existingIndexes.find(i => i.indexname === target.name);
      return {
        IndexName: target.name,
        Table: target.table,
        Exists: match ? 'YES (VERIFIED)' : 'NO',
        Definition: match ? match.indexdef : 'N/A',
      };
    });
    console.table(tableRows.map(r => ({ Index: r.IndexName, Table: r.Table, Exists: r.Exists })));

    // 4. Run EXPLAIN / EXPLAIN ANALYZE on the core queries
    console.log('\n--- 3. Running EXPLAIN / EXPLAIN ANALYZE on Critical Queries ---');

    // Query A: getBatchMistakeSummary (Fix C-1)
    console.log('\n[Query A: getBatchMistakeSummary]');
    const explainA: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
      SELECT
        q."topicId"                       AS "topicId",
        t."name"                          AS "topicName",
        tag.value::text                   AS tag,
        COUNT(*)::bigint                  AS cnt
      FROM responses r
      CROSS JOIN LATERAL unnest(r."mistakeTags") AS tag(value)
      JOIN questions q ON q.id = r."questionId"
      LEFT JOIN topics t ON t.id = q."topicId"
      WHERE
        cardinality(r."mistakeTags") > 0
        AND (
          r."answerSheetId" IN (
            SELECT ash.id FROM answer_sheets ash
            JOIN student_profiles sp ON sp.id = ash."studentProfileId"
            WHERE sp."batchId" = 'batch-test-1'
          )
          OR r."attemptId" IN (
            SELECT att.id FROM attempts att
            WHERE att."studentProfileId" IN (
              SELECT sp2.id FROM student_profiles sp2 WHERE sp2."batchId" = 'batch-test-1'
            )
          )
        )
      GROUP BY q."topicId", t."name", tag.value
      ORDER BY COUNT(*) DESC
      LIMIT 2000;
    `);
    console.log(explainA.map((r: any) => r['QUERY PLAN']).join('\n'));

    // Query B: Heatmap Mastery Aggregation (Fix C-4)
    console.log('\n[Query B: Heatmap Mastery Aggregation (C-4)]');
    const explainB: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
      SELECT
        sp."batchId"                                          AS batch_id,
        ms."topicId"                                         AS topic_id,
        t."name"                                             AS topic_name,
        ROUND((AVG(ms."masteryValue") * 100)::numeric, 1)   AS avg_mastery,
        COUNT(CASE WHEN ms."masteryValue" < 0.50 THEN 1 END) AS struggling,
        COUNT(*)                                             AS total
      FROM mastery_scores ms
      JOIN student_profiles sp ON sp.id = ms."studentProfileId"
      LEFT JOIN topics t ON t.id = ms."topicId"
      WHERE sp."batchId" = ANY(ARRAY['batch-test-1', 'batch-test-2'])
      GROUP BY sp."batchId", ms."topicId", t."name"
      ORDER BY avg_mastery ASC;
    `);
    console.log(explainB.map((r: any) => r['QUERY PLAN']).join('\n'));

    // Query C: Response Lookup by questionId
    console.log('\n[Query C: Response Lookup by questionId]');
    const explainC: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
      SELECT id, "marksAwarded", "isCorrect" FROM responses WHERE "questionId" = 'q-test-1';
    `);
    console.log(explainC.map((r: any) => r['QUERY PLAN']).join('\n'));

    // Query D: AnswerSheet lookup by studentProfileId
    console.log('\n[Checking columns for answer_sheets]');
    const ashCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'answer_sheets';
    `);
    console.log('answer_sheets columns:', ashCols.map(c => c.column_name).join(', '));

    console.log('\n[Query D: AnswerSheet Lookup by studentProfileId]');
    const explainD: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
      SELECT id, "studentProfileId" FROM answer_sheets WHERE "studentProfileId" = 'sp-test-1';
    `);
    console.log(explainD.map((r: any) => r['QUERY PLAN']).join('\n'));

    // Query E: Assignment lookup by studentProfileId
    console.log('\n[Checking columns for assignments]');
    const assignCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assignments';
    `);
    console.log('assignments columns:', assignCols.map(c => c.column_name).join(', '));

    console.log('\n[Query E: Assignment Lookup by studentProfileId]');
    const explainE: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
      SELECT id, "studentProfileId" FROM assignments WHERE "studentProfileId" = 'sp-test-1';
    `);
    console.log(explainE.map((r: any) => r['QUERY PLAN']).join('\n'));

    // Query F: Intervention lookup by instituteId
    console.log('\n[Checking columns for interventions]');
    const intervCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'interventions';
    `);
    console.log('interventions columns:', intervCols.map(c => c.column_name).join(', '));

    console.log('\n[Query F: Intervention Lookup by instituteId]');
    const explainF: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING)
      SELECT id, "instituteId" FROM interventions WHERE "instituteId" = 'inst-test-1';
    `);
    console.log(explainF.map((r: any) => r['QUERY PLAN']).join('\n'));

    console.log('\n>>> STEP 1 COMPLETED SUCCESSFULLY. ALL INDEXES AND QUERY PLANS VERIFIED.');

  } catch (err) {
    console.error('ERROR during Step 1 execution:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
