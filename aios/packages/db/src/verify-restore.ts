/* Proves a restored database is usable BY THE APPLICATION, not merely
 * structurally intact.
 *
 *   DATABASE_URL=postgresql://... npx tsx packages/db/src/verify-restore.ts
 *
 * Lives in packages/db rather than infra/backup because it is the only piece of
 * the backup tooling that imports @prisma/client, and Node resolves that from
 * the importing FILE's directory — from infra/ it is simply not on the path.
 *
 * restore.js already compares the restored database against the backup manifest
 * — table counts, index counts, exact row counts, FK validation. That proves the
 * bytes came back. It does NOT prove the thing an incident actually turns on:
 * that Prisma can connect, that the relations the app traverses still resolve,
 * and that constraints are ENFORCING rather than merely present in the catalog.
 *
 * A restore that satisfies pg_restore but fails the first real query is a
 * restore that will be discovered broken at the worst moment, so the drill
 * includes this step and treats its failure as a failed restore.
 */
import { PrismaClient } from '@prisma/client';

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const prisma = new PrismaClient();
  const checks: Check[] = [];
  let exitCode = 0;

  try {
    // 1. Connectivity — the client can reach the restored database at all.
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'prisma connects', ok: true, detail: 'SELECT 1 succeeded' });

    // 2. A multi-level relational read. This is the shape every tenant-scoped
    //    query in the app uses; if the FKs or the rows behind them did not
    //    survive, the includes come back empty rather than throwing, which is
    //    why each level is asserted rather than just awaited.
    const institute = await prisma.institute.findFirst({
      include: {
        users: true,
        batches: true,
        subjects: { include: { chapters: { include: { topics: true } } } },
      },
    });
    if (!institute) throw new Error('no Institute rows — the restored database has no tenant');

    const subject = institute.subjects[0];
    const chapter = subject?.chapters[0];
    const topic = chapter?.topics[0];
    const chainIntact = Boolean(subject && chapter && topic);
    checks.push({
      name: 'institute -> subject -> chapter -> topic',
      ok: chainIntact,
      detail: chainIntact
        ? `${institute.name} / ${subject!.name} / ${chapter!.name} / ${topic!.name}`
        : 'relation chain broken — a level came back empty',
    });
    if (!chainIntact) exitCode = 1;

    checks.push({
      name: 'tenant members restored',
      ok: institute.users.length > 0 && institute.batches.length > 0,
      detail: `${institute.users.length} users, ${institute.batches.length} batches`,
    });
    if (!(institute.users.length > 0 && institute.batches.length > 0)) exitCode = 1;

    // 3. A join the app really runs: questions reachable only by walking
    //    topic -> chapter -> subject -> institute. Exercises four FKs at once.
    const reachableQuestions = await prisma.question.count({
      where: { topic: { chapter: { subject: { instituteId: institute.id } } } },
    });
    checks.push({
      name: 'questions reachable through the topic hierarchy',
      ok: reachableQuestions > 0,
      detail: `${reachableQuestions} questions`,
    });
    if (reachableQuestions === 0) exitCode = 1;

    // 4. Constraints ENFORCING, not just catalogued. A restore that loaded data
    //    with triggers disabled and never re-enabled them would pass every
    //    structural check above and still accept orphan rows.
    let fkEnforced = false;
    let fkDetail = 'orphan row was ACCEPTED — foreign keys are not enforcing';
    try {
      await prisma.question.create({
        data: {
          instituteId: institute.id,
          topicId: 'topic-that-does-not-exist',
          content: 'restore drill probe — must never persist',
          type: 'MCQ',
          difficulty: 'EASY',
          marks: 1,
        } as never,
      });
    } catch (err) {
      fkEnforced = true;
      const code = (err as { code?: string }).code ?? 'error';
      fkDetail = `orphan row rejected (${code})`;
    }
    checks.push({ name: 'foreign keys enforce on write', ok: fkEnforced, detail: fkDetail });
    if (!fkEnforced) exitCode = 1;

    // 5. Unique constraints enforcing. Prisma emits @@unique as unique INDEXes,
    //    so the structural check counts them as indexes and cannot tell whether
    //    they are unique. Writing a duplicate is the only way to know.
    let uniqueEnforced = false;
    let uniqueDetail = 'duplicate accepted — unique constraints are not enforcing';
    const existingUser = institute.users[0]!;
    try {
      await prisma.user.create({
        data: {
          instituteId: institute.id,
          email: existingUser.email, // User.email is @unique
          name: 'restore drill probe — must never persist',
          role: existingUser.role,
        } as never,
      });
    } catch (err) {
      uniqueEnforced = true;
      uniqueDetail = `duplicate email rejected (${(err as { code?: string }).code ?? 'error'})`;
    }
    checks.push({ name: 'unique constraints enforce on write', ok: uniqueEnforced, detail: uniqueDetail });
    if (!uniqueEnforced) exitCode = 1;
  } catch (err) {
    checks.push({ name: 'fatal', ok: false, detail: (err as Error).message });
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\nAPPLICATION CONNECTIVITY AGAINST THE RESTORED DATABASE');
  for (const c of checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);
  }
  console.log(
    exitCode === 0
      ? '\nThe application can use this database.'
      : '\nThe restored database is NOT usable by the application.',
  );
  process.exit(exitCode);
}

void main();
