'use strict';

/**
 * AIOS / SARVLEKH — Database Constraints, Data Integrity & Concurrency Test
 * 
 * Tests against live PostgreSQL:
 *   1. Nullable uniqueness in BatchEnrollment (multiple NULL roll numbers allowed).
 *   2. Strict rejection of duplicate active roll numbers within the same batch.
 *   3. Scope isolation allowing identical roll numbers across different batches.
 *   4. Evaluator delivery-level allocation uniqueness (student-wise).
 *   5. Attempt rollNumberSnapshot immutability.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

describe('Database Constraints, Tenancy & Relational Uniqueness (Live PostgreSQL)', () => {
  let prisma;
  let testInstituteId;
  let testShortCode;
  let adminUser;
  let captureProvider;
  let evaluationPolicy;
  let batchA;
  let batchB;
  let student1;
  let student2;
  let student3;

  before(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const timestamp = Date.now();
    testShortCode = `DBC${timestamp.toString().slice(-4)}`;

    // Create an isolated test institute
    const institute = await prisma.institute.create({
      data: {
        name: `DB Integrity Test ${timestamp}`,
        shortCode: testShortCode,
        domainAllowlist: [],
      },
    });
    testInstituteId = institute.id;

    // Create Admin User
    adminUser = await prisma.user.create({
      data: {
        instituteId: testInstituteId,
        email: `admin_${timestamp}@test.local`,
        name: 'DB Admin',
        role: 'ADMIN',
      },
    });

    // Create default CaptureProvider & EvaluationPolicy
    captureProvider = await prisma.captureProvider.create({
      data: {
        instituteId: testInstituteId,
        type: 'PHOTO_CAPTURE_SUBJECTIVE',
        config: {},
      },
    });

    evaluationPolicy = await prisma.evaluationPolicy.create({
      data: {
        instituteId: testInstituteId,
        name: 'Mandatory Review',
        mode: 'AI_ASSIST_MANDATORY_REVIEW',
        requiresHumanReview: true,
      },
    });

    // Create two separate batches
    batchA = await prisma.batch.create({
      data: {
        instituteId: testInstituteId,
        name: 'Batch Class 10-A',
        academicYear: '2025-2026',
      },
    });

    batchB = await prisma.batch.create({
      data: {
        instituteId: testInstituteId,
        name: 'Batch Class 10-B',
        academicYear: '2025-2026',
      },
    });

    // Create 3 student profiles
    const u1 = await prisma.user.create({
      data: {
        instituteId: testInstituteId,
        email: `stu1_${timestamp}@test.local`,
        name: 'Student One',
        role: 'STUDENT',
      },
    });
    student1 = await prisma.studentProfile.create({
      data: {
        instituteId: testInstituteId,
        userId: u1.id,
        studentCode: `${testShortCode}-STU-001`,
      },
    });

    const u2 = await prisma.user.create({
      data: {
        instituteId: testInstituteId,
        email: `stu2_${timestamp}@test.local`,
        name: 'Student Two',
        role: 'STUDENT',
      },
    });
    student2 = await prisma.studentProfile.create({
      data: {
        instituteId: testInstituteId,
        userId: u2.id,
        studentCode: `${testShortCode}-STU-002`,
      },
    });

    const u3 = await prisma.user.create({
      data: {
        instituteId: testInstituteId,
        email: `stu3_${timestamp}@test.local`,
        name: 'Student Three',
        role: 'STUDENT',
      },
    });
    student3 = await prisma.studentProfile.create({
      data: {
        instituteId: testInstituteId,
        userId: u3.id,
        studentCode: `${testShortCode}-STU-003`,
      },
    });
  });

  after(async () => {
    if (prisma && testInstituteId) {
      // Clean up isolated test data
      await prisma.batchEnrollment.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.copyCheckerStudentAllocation.deleteMany({ where: { studentProfile: { instituteId: testInstituteId } } });
      await prisma.copyCheckerAssignment.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.attempt.deleteMany({ where: { studentProfile: { instituteId: testInstituteId } } });
      await prisma.assessmentDelivery.deleteMany({ where: { assessment: { instituteId: testInstituteId } } });
      await prisma.assessment.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.evaluationPolicy.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.captureProvider.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.teacherProfile.deleteMany({ where: { user: { instituteId: testInstituteId } } });
      await prisma.studentProfile.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.user.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.batch.deleteMany({ where: { instituteId: testInstituteId } });
      await prisma.institute.delete({ where: { id: testInstituteId } });
      await prisma.$disconnect();
    }
  });

  test('Constraint 1: Permits multiple active enrollments with NULL rollNumber in the same batch', async () => {
    // Student 1 enrolled with NULL roll
    const e1 = await prisma.batchEnrollment.create({
      data: {
        instituteId: testInstituteId,
        batchId: batchA.id,
        studentProfileId: student1.id,
        rollNumber: null,
        status: 'ACTIVE',
      },
    });
    assert.ok(e1.id);

    // Student 2 enrolled with NULL roll in same batch -> MUST SUCCEED (PostgreSQL partial unique index)
    const e2 = await prisma.batchEnrollment.create({
      data: {
        instituteId: testInstituteId,
        batchId: batchA.id,
        studentProfileId: student2.id,
        rollNumber: null,
        status: 'ACTIVE',
      },
    });
    assert.ok(e2.id);

    // Clean up null enrollments
    await prisma.batchEnrollment.deleteMany({ where: { batchId: batchA.id } });
  });

  test('Constraint 2: Rejects duplicate non-null roll numbers in the same active batch', async () => {
    // Student 1 assigned roll "101"
    await prisma.batchEnrollment.create({
      data: {
        instituteId: testInstituteId,
        batchId: batchA.id,
        studentProfileId: student1.id,
        rollNumber: '101',
        status: 'ACTIVE',
      },
    });

    // Student 2 assigned duplicate roll "101" in Batch A -> MUST FAIL with P2002
    await assert.rejects(
      async () => {
        await prisma.batchEnrollment.create({
          data: {
            instituteId: testInstituteId,
            batchId: batchA.id,
            studentProfileId: student2.id,
            rollNumber: '101',
            status: 'ACTIVE',
          },
        });
      },
      (err) => {
        assert.equal(err.code, 'P2002', 'Prisma unique constraint violation code should be P2002');
        return true;
      }
    );
  });

  test('Constraint 3: Allows identical roll number in a different batch (Batch Scope Isolation)', async () => {
    // Student 3 assigned roll "101" in Batch B -> MUST SUCCEED
    const e3 = await prisma.batchEnrollment.create({
      data: {
        instituteId: testInstituteId,
        batchId: batchB.id,
        studentProfileId: student3.id,
        rollNumber: '101',
        status: 'ACTIVE',
      },
    });
    assert.ok(e3.id);
    assert.equal(e3.rollNumber, '101');
  });

  test('Constraint 4: Delivery-level evaluator uniqueness prevents double-allocation of students', async () => {
    // Create an assessment and delivery
    const assessment = await prisma.assessment.create({
      data: {
        instituteId: testInstituteId,
        title: 'Physics Test 1',
        assessmentKind: 'COACHING_TEST',
        stakesLevel: 'GRADED',
        totalMarks: 50.0,
        createdByUserId: adminUser.id,
      },
    });

    const delivery = await prisma.assessmentDelivery.create({
      data: {
        assessmentId: assessment.id,
        batchId: batchA.id,
        status: 'ONGOING',
        captureProviderId: captureProvider.id,
        evaluationPolicyId: evaluationPolicy.id,
        createdByUserId: adminUser.id,
      },
    });

    // Create 2 teachers & teacher profiles
    const tUser1 = await prisma.user.create({
      data: { instituteId: testInstituteId, email: `t1_${Date.now()}@test.local`, name: 'Teacher 1', role: 'TEACHER' },
    });
    const tp1 = await prisma.teacherProfile.create({
      data: { userId: tUser1.id, teacherCode: `${testShortCode}-TCH-001` },
    });

    const tUser2 = await prisma.user.create({
      data: { instituteId: testInstituteId, email: `t2_${Date.now()}@test.local`, name: 'Teacher 2', role: 'TEACHER' },
    });
    const tp2 = await prisma.teacherProfile.create({
      data: { userId: tUser2.id, teacherCode: `${testShortCode}-TCH-002` },
    });

    // Create assignment for Teacher 1
    const assign1 = await prisma.copyCheckerAssignment.create({
      data: {
        instituteId: testInstituteId,
        assessmentDeliveryId: delivery.id,
        teacherProfileId: tp1.id,
        scope: 'STUDENT_LIST',
      },
    });

    // Allocate student1 to Teacher 1
    await prisma.copyCheckerStudentAllocation.create({
      data: {
        copyCheckerAssignmentId: assign1.id,
        assessmentDeliveryId: delivery.id,
        studentProfileId: student1.id,
      },
    });

    // Create assignment for Teacher 2
    const assign2 = await prisma.copyCheckerAssignment.create({
      data: {
        instituteId: testInstituteId,
        assessmentDeliveryId: delivery.id,
        teacherProfileId: tp2.id,
        scope: 'STUDENT_LIST',
      },
    });

    // Attempt to allocate the same student1 to Teacher 2 on the SAME delivery -> MUST FAIL with P2002
    await assert.rejects(
      async () => {
        await prisma.copyCheckerStudentAllocation.create({
          data: {
            copyCheckerAssignmentId: assign2.id,
            assessmentDeliveryId: delivery.id,
            studentProfileId: student1.id,
          },
        });
      },
      (err) => {
        assert.equal(err.code, 'P2002', 'Duplicate student allocation across teachers on same delivery rejected');
        return true;
      }
    );
  });

  test('Constraint 5: Attempt rollNumberSnapshot is immutable when student roll changes later', async () => {
    const assessment = await prisma.assessment.findFirst({ where: { instituteId: testInstituteId } });
    const delivery = await prisma.assessmentDelivery.findFirst({ where: { assessmentId: assessment.id } });

    // Create attempt with rollNumberSnapshot '101'
    const attempt = await prisma.attempt.create({
      data: {
        assessmentDeliveryId: delivery.id,
        studentProfileId: student1.id,
        rollNumberSnapshot: '101',
        status: 'SUBMITTED',
      },
    });

    assert.equal(attempt.rollNumberSnapshot, '101');

    // Update enrollment roll to '999'
    await prisma.batchEnrollment.updateMany({
      where: { studentProfileId: student1.id, batchId: batchA.id },
      data: { rollNumber: '999' },
    });

    // Verify attempt still retains historical snapshot '101'
    const fetchedAttempt = await prisma.attempt.findUnique({ where: { id: attempt.id } });
    assert.equal(fetchedAttempt.rollNumberSnapshot, '101', 'Attempt rollNumberSnapshot must remain immutable');
  });
});
