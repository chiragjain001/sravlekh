import axios from 'axios';
import { PrismaClient, InstituteStatus, InstitutePlan } from '@prisma/client';

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function run() {
  console.log('🧪 Starting Super Admin / Founder Institute Operations Verification...');

  // 1. Login as Founder
  const founderLogin = await axios.post(`${API_BASE}/auth/dev-login`, { role: 'FOUNDER' });
  const founderToken = founderLogin.data.accessToken;
  const authHeaders = { Authorization: `Bearer ${founderToken}` };
  console.log('✅ Logged in as FOUNDER (Super Admin)');

  // 2. Create a test institute
  const testShortCode = `TI${Date.now().toString().slice(-4)}`;
  const createRes = await axios.post(
    `${API_BASE}/institutes`,
    {
      name: `Test Academy ${testShortCode}`,
      domainAllowlist: ['testacademy.edu'],
      plan: 'BASIC',
      address: 'Test City, State',
      phone: '+91 9999900001',
    },
    { headers: authHeaders }
  );
  const testInstId = createRes.data.id;
  console.log(`✅ Created test institute "${createRes.data.name}" with ID: ${testInstId}`);

  // 3. EDIT TEST: Update Name, Address, Phone, Domain Allowlist
  console.log('\n📝 Testing EDIT institute details...');
  const updatedName = `Updated Academy ${testShortCode}`;
  const updatedAddress = '456 Innovation Park, Bangalore';
  const updatedPhone = '+91 9888877777';
  const updatedAllowlist = ['testacademy.edu', 'updatedacademy.org'];

  const editRes = await axios.patch(
    `${API_BASE}/institutes/${testInstId}`,
    {
      name: updatedName,
      address: updatedAddress,
      phone: updatedPhone,
      domainAllowlist: updatedAllowlist,
    },
    { headers: authHeaders }
  );
  console.log('✅ PATCH /institutes/:id response status:', editRes.status);

  // EDIT PLAN: Upgrade plan from BASIC to ENTERPRISE
  console.log('📝 Testing EDIT institute subscription plan...');
  const planRes = await axios.patch(
    `${API_BASE}/founder/institutes/${testInstId}/plan`,
    { plan: 'ENTERPRISE', reason: 'Upgraded by Super Admin in test' },
    { headers: authHeaders }
  );
  console.log('✅ PATCH /founder/institutes/:id/plan response status:', planRes.status);

  // Verify in PostgreSQL via Prisma
  const dbInstAfterEdit = await prisma.institute.findUnique({ where: { id: testInstId } });
  if (
    dbInstAfterEdit?.name === updatedName &&
    dbInstAfterEdit?.address === updatedAddress &&
    dbInstAfterEdit?.phone === updatedPhone &&
    dbInstAfterEdit?.plan === InstitutePlan.ENTERPRISE &&
    dbInstAfterEdit?.domainAllowlist.includes('updatedacademy.org')
  ) {
    console.log('✅ PostgreSQL DB Verification PASSED: Name, address, phone, plan, and domainAllowlist correctly updated!');
  } else {
    throw new Error(`DB verification failed after edit: ${JSON.stringify(dbInstAfterEdit)}`);
  }

  // 4. DEACTIVATE (SUSPEND) TEST
  console.log('\n⏸️ Testing DEACTIVATE (Suspend) institute...');
  // First ensure institute is active
  await prisma.institute.update({ where: { id: testInstId }, data: { status: InstituteStatus.ACTIVE } });

  const suspendRes = await axios.patch(
    `${API_BASE}/founder/institutes/${testInstId}/suspend`,
    {},
    { headers: authHeaders }
  );
  console.log('✅ PATCH /founder/institutes/:id/suspend response status:', suspendRes.status);

  const dbInstSuspended = await prisma.institute.findUnique({ where: { id: testInstId } });
  if (dbInstSuspended?.status === InstituteStatus.SUSPENDED) {
    console.log('✅ PostgreSQL DB Verification PASSED: Status is SUSPENDED (Deactivated)');
  } else {
    throw new Error(`DB verification failed after suspend: status is ${dbInstSuspended?.status}`);
  }

  // 5. REACTIVATE TEST
  console.log('\n▶️ Testing REACTIVATE institute...');
  const reactivateRes = await axios.patch(
    `${API_BASE}/founder/institutes/${testInstId}/reactivate`,
    {},
    { headers: authHeaders }
  );
  console.log('✅ PATCH /founder/institutes/:id/reactivate response status:', reactivateRes.status);

  const dbInstReactivated = await prisma.institute.findUnique({ where: { id: testInstId } });
  if (dbInstReactivated?.status === InstituteStatus.ACTIVE) {
    console.log('✅ PostgreSQL DB Verification PASSED: Status is back to ACTIVE');
  } else {
    throw new Error(`DB verification failed after reactivate: status is ${dbInstReactivated?.status}`);
  }

  // 6. DELETE (ARCHIVE) TEST
  console.log('\n🗑️ Testing DELETE (Archive / Soft-Delete) institute...');
  const archiveRes = await axios.post(
    `${API_BASE}/founder/institutes/${testInstId}/archive`,
    {},
    { headers: authHeaders }
  );
  console.log('✅ POST /founder/institutes/:id/archive response status:', archiveRes.status);

  const dbInstArchived = await prisma.institute.findUnique({ where: { id: testInstId } });
  if (dbInstArchived?.status === InstituteStatus.ARCHIVED) {
    console.log('✅ PostgreSQL DB Verification PASSED: Status is ARCHIVED (Safely soft-deleted with records preserved)');
  } else {
    throw new Error(`DB verification failed after archive: status is ${dbInstArchived?.status}`);
  }

  // Cleanup note: Institute is safely ARCHIVED. AuditLog is insert-only per 07-SECURITY-SPECIFICATION.md §13
  console.log('🔒 Institute is safely preserved in ARCHIVED status (audit_logs is insert-only per security spec).');
  console.log('\n🎉 ALL 4 OPERATIONS (EDIT, DEACTIVATE/SUSPEND, REACTIVATE, DELETE/ARCHIVE) FULLY VERIFIED ON API & POSTGRESQL!');
}

run()
  .catch((err) => {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
