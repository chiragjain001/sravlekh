import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function run() {
  console.log('📋 Starting Live Attendance, Student Tagging & Allow-list Mutation Test...\n');

  // 1. Logins
  const adminRes = await axios.post(`${API_BASE}/auth/dev-login`, { role: 'ADMIN' });
  const teacherRes = await axios.post(`${API_BASE}/auth/dev-login`, { role: 'TEACHER' });
  const studentRes = await axios.post(`${API_BASE}/auth/dev-login`, { role: 'STUDENT' });

  const adminHeaders = { Authorization: `Bearer ${adminRes.data.accessToken}` };
  const teacherHeaders = { Authorization: `Bearer ${teacherRes.data.accessToken}` };
  const studentHeaders = { Authorization: `Bearer ${studentRes.data.accessToken}` };

  // 2. Student Profile Tagging
  console.log('🏷️ [Workflow E1] ADMIN -> Update Student Profile Tags');
  const studentProfile = await prisma.studentProfile.findFirst({
    where: { instituteId: 'demo-institute-1' },
  });
  if (studentProfile) {
    const tagRes = await axios.patch(
      `${API_BASE}/institutes/demo-institute-1/students/${studentProfile.id}/tags`,
      { tags: ['fast-learner', 'ready-for-hard-paper'] },
      { headers: adminHeaders }
    );
    console.log(`✅ Status: ${tagRes.status} | Updated tags:`, tagRes.data.tags);
  }

  // 3. Admin Allow-List Management
  console.log('\n📧 [Workflow E2] ADMIN -> Add and Remove Email Allow-List Entry');
  const testEmail = `teacher.temp.${Date.now()}@sunrisecoaching.com`;
  const addAllowRes = await axios.post(
    `${API_BASE}/institutes/demo-institute-1/allow-list`,
    { email: testEmail, role: 'TEACHER' },
    { headers: adminHeaders }
  );
  console.log(`✅ Status: ${addAllowRes.status} | Added allow-list entry for ${testEmail}`);

  const listRes = await axios.get(`${API_BASE}/institutes/demo-institute-1/allow-list`, { headers: adminHeaders });
  const addedEntry = listRes.data.find((e: any) => e.email === testEmail);
  if (addedEntry) {
    const delRes = await axios.delete(
      `${API_BASE}/institutes/demo-institute-1/allow-list/${addedEntry.id}`,
      { headers: adminHeaders }
    );
    console.log(`✅ Status: ${delRes.status} | Removed allow-list entry ID: ${addedEntry.id}`);
  }

  // 4. Student queries own profile & attendance stats
  console.log('\n📊 [Workflow E3] STUDENT -> Query Self Profile & Attendance Stats');
  const studentMeRes = await axios.get(`${API_BASE}/institutes/demo-institute-1/students/me`, { headers: studentHeaders });
  console.log(`✅ Status: ${studentMeRes.status} | Student verified: ${studentMeRes.data.user?.name || studentMeRes.data.id}`);

  // 5. Admin queries Attendance Missing Scan
  console.log('\n⏱️ [Workflow E4] ADMIN -> Run Attendance Missing Check Scan');
  const scanRes = await axios.post(
    `${API_BASE}/institutes/demo-institute-1/attendance/detect-missing`,
    {},
    { headers: adminHeaders }
  );
  console.log(`✅ Status: ${scanRes.status} | Missing attendance scan result:`, scanRes.data);

  const missingRes = await axios.get(
    `${API_BASE}/institutes/demo-institute-1/attendance/missing`,
    { headers: adminHeaders }
  );
  console.log(`✅ Status: ${missingRes.status} | Today missing sessions count:`, missingRes.data?.length ?? 0);

  console.log('\n🎉 ALL ADDITIONAL MULTI-ROLE WORKFLOWS COMPLETED SUCCESSFULLY!');
}

run()
  .catch((err) => {
    console.error('Workflow error:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
