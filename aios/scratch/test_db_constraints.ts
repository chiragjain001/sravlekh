import { PrismaClient, EnrollmentStatus } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('Connected to database.');

  const testId = `test-${Date.now()}`;
  let instituteId = '';

  try {
    // 1. Create a dedicated test institute
    const institute = await prisma.institute.create({
      data: {
        name: `DB Constraint Test ${testId}`,
        domainAllowlist: [],
        shortCode: `T${testId.slice(-4)}`,
      },
    });
    instituteId = institute.id;
    console.log('Created test institute:', instituteId);

    // 2. Create two batches
    const batch1 = await prisma.batch.create({
      data: { instituteId, name: 'Batch A' },
    });
    const batch2 = await prisma.batch.create({
      data: { instituteId, name: 'Batch B' },
    });

    // 3. Create three test students
    const user1 = await prisma.user.create({
      data: { instituteId, email: `s1_${testId}@test.local`, name: 'Student 1', role: 'STUDENT' },
    });
    const sp1 = await prisma.studentProfile.create({
      data: { instituteId, userId: user1.id, studentCode: `STU-1-${testId.slice(-4)}` },
    });

    const user2 = await prisma.user.create({
      data: { instituteId, email: `s2_${testId}@test.local`, name: 'Student 2', role: 'STUDENT' },
    });
    const sp2 = await prisma.studentProfile.create({
      data: { instituteId, userId: user2.id, studentCode: `STU-2-${testId.slice(-4)}` },
    });

    const user3 = await prisma.user.create({
      data: { instituteId, email: `s3_${testId}@test.local`, name: 'Student 3', role: 'STUDENT' },
    });
    const sp3 = await prisma.studentProfile.create({
      data: { instituteId, userId: user3.id, studentCode: `STU-3-${testId.slice(-4)}` },
    });

    console.log('--- TEST 1: Multiple null roll numbers in the same batch ---');
    // Student 1 enrolled with rollNumber = null
    const e1 = await prisma.batchEnrollment.create({
      data: { instituteId, batchId: batch1.id, studentProfileId: sp1.id, rollNumber: null },
    });
    // Student 2 enrolled in same batch with rollNumber = null
    const e2 = await prisma.batchEnrollment.create({
      data: { instituteId, batchId: batch1.id, studentProfileId: sp2.id, rollNumber: null },
    });
    console.log('OK: Both enrollments with null rollNumber created successfully without error.');

    console.log('--- TEST 2: Assign distinct non-null roll numbers ---');
    await prisma.batchEnrollment.update({
      where: { id: e1.id },
      data: { rollNumber: '101' },
    });
    await prisma.batchEnrollment.update({
      where: { id: e2.id },
      data: { rollNumber: '102' },
    });
    console.log('OK: Distinct roll numbers 101 and 102 updated successfully.');

    console.log('--- TEST 3: Duplicate roll number in same batch must be rejected ---');
    let rejected = false;
    try {
      // Try to enroll Student 3 with duplicate rollNumber '101' in Batch 1
      await prisma.batchEnrollment.create({
        data: { instituteId, batchId: batch1.id, studentProfileId: sp3.id, rollNumber: '101' },
      });
    } catch (err: any) {
      rejected = true;
      console.log('OK: Duplicate rollNumber 101 rejected as expected with code:', err.code);
    }
    if (!rejected) {
      throw new Error('FAIL: Duplicate roll number 101 was not rejected!');
    }

    console.log('--- TEST 4: Same roll number in DIFFERENT batch must succeed ---');
    const e3 = await prisma.batchEnrollment.create({
      data: { instituteId, batchId: batch2.id, studentProfileId: sp3.id, rollNumber: '101' },
    });
    console.log('OK: Roll number 101 in Batch B created successfully.');

    console.log('--- TEST 5: Batch transfer & re-enrollment ---');
    // Transfer Student 1 from Batch A
    await prisma.batchEnrollment.update({
      where: { id: e1.id },
      data: { status: EnrollmentStatus.TRANSFERRED, transferredAt: new Date() },
    });
    // Now enroll Student 1 in Batch B with a new roll number
    const e1_b2 = await prisma.batchEnrollment.create({
      data: { instituteId, batchId: batch2.id, studentProfileId: sp1.id, rollNumber: '201' },
    });
    console.log('OK: Batch transfer and re-enrollment verified successfully.');

    console.log('========================================================');
    console.log('>>> ALL 5 DATABASE INTEGRITY CHECKS PASSED LIVE IN PG! <<<');
    console.log('========================================================');
  } finally {
    // Clean up test institute
    if (instituteId) {
      await prisma.institute.delete({ where: { id: instituteId } }).catch(() => undefined);
      console.log('Cleaned up test institute:', instituteId);
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
