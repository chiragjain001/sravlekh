import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

interface AuditResult {
  category: string;
  testCase: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'SECURITY_FINDING';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: string;
}

const auditResults: AuditResult[] = [];

async function loginAsRole(role: string): Promise<{ token: string; user: any; cookie?: string }> {
  const res = await axios.post(`${API_BASE}/auth/dev-login`, { role });
  const cookie = res.headers['set-cookie']?.join('; ');
  return {
    token: res.data.accessToken,
    user: res.data.user,
    cookie,
  };
}

async function runSecurityAudit() {
  console.log('🛡️ Starting AIOS Pre-Launch Security Audit Probes...');

  // 1. Unauthenticated endpoints check
  try {
    const res = await axios.get(`${API_BASE}/auth/me`);
    auditResults.push({
      category: 'Authentication',
      testCase: 'Unauthenticated /auth/me access',
      expected: '401 Unauthorized',
      actual: `Status ${res.status}`,
      status: 'SECURITY_FINDING',
      severity: 'CRITICAL',
      details: 'Unauthenticated caller was able to access /auth/me',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'Authentication',
      testCase: 'Unauthenticated /auth/me access',
      expected: '401 Unauthorized',
      actual: `Status ${status}`,
      status: status === 401 ? 'PASS' : 'FAIL',
    });
  }

  // 2. Refresh without cookie
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, {});
    auditResults.push({
      category: 'Authentication',
      testCase: 'Refresh token without cookie',
      expected: '401 Unauthorized',
      actual: `Status ${res.status}`,
      status: 'SECURITY_FINDING',
      severity: 'HIGH',
      details: 'Able to refresh session without refresh cookie',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'Authentication',
      testCase: 'Refresh token without cookie',
      expected: '401 Unauthorized',
      actual: `Status ${status}`,
      status: status === 401 ? 'PASS' : 'FAIL',
    });
  }

  // 3. Log in as each role
  const roles = ['STUDENT', 'TEACHER', 'ADMIN', 'FOUNDER'];
  const sessions: Record<string, { token: string; user: any; cookie?: string }> = {};

  for (const role of roles) {
    try {
      sessions[role] = await loginAsRole(role);
      const user = sessions[role].user;
      auditResults.push({
        category: 'Authentication',
        testCase: `Mock login as ${role}`,
        expected: `200 OK with role ${role}`,
        actual: `Role: ${user.role}, Institute: ${user.instituteId}`,
        status: user.role === role ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      auditResults.push({
        category: 'Authentication',
        testCase: `Mock login as ${role}`,
        expected: `200 OK`,
        actual: `Failed: ${err.message}`,
        status: 'FAIL',
      });
    }
  }

  const studentHeaders = { Authorization: `Bearer ${sessions['STUDENT']?.token}` };
  const teacherHeaders = { Authorization: `Bearer ${sessions['TEACHER']?.token}` };
  const adminHeaders = { Authorization: `Bearer ${sessions['ADMIN']?.token}` };
  const founderHeaders = { Authorization: `Bearer ${sessions['FOUNDER']?.token}` };

  // 4. RBAC: Student attempting Admin/Teacher actions
  const studentPrivEscalationChecks = [
    { method: 'post', url: `${API_BASE}/institutes/demo-institute-1/exams`, body: { title: 'Hacked Exam' }, name: 'Student create exam' },
    { method: 'get', url: `${API_BASE}/institutes/demo-institute-1/audit-logs`, body: null, name: 'Student access audit logs' },
    { method: 'post', url: `${API_BASE}/institutes/demo-institute-1/deliveries/demo-delivery/print-runs`, body: {}, name: 'Student generate booklets' },
    { method: 'get', url: `${API_BASE}/founder/institutes`, body: null, name: 'Student access founder institutes' },
    { method: 'post', url: `${API_BASE}/institutes/demo-institute-1/deliveries/demo-delivery/copy-checkers`, body: {}, name: 'Student assign copy checkers' },
  ];

  for (const check of studentPrivEscalationChecks) {
    try {
      const res = check.method === 'post' 
        ? await axios.post(check.url, check.body, { headers: studentHeaders })
        : await axios.get(check.url, { headers: studentHeaders });
      
      auditResults.push({
        category: 'RBAC & Privilege Escalation',
        testCase: check.name,
        expected: '403 Forbidden',
        actual: `Status ${res.status} (Allowed)`,
        status: 'SECURITY_FINDING',
        severity: 'HIGH',
        details: `Student successfully executed privileged endpoint ${check.url}`,
      });
    } catch (err: any) {
      const status = err.response?.status;
      auditResults.push({
        category: 'RBAC & Privilege Escalation',
        testCase: check.name,
        expected: '403 Forbidden',
        actual: `Status ${status}`,
        status: (status === 403 || status === 401) ? 'PASS' : 'FAIL',
        details: status === 400 ? `Failed with 400 validation instead of 403: ${JSON.stringify(err.response?.data)}` : undefined,
      });
    }
  }

  // 5. RBAC: Teacher attempting Founder actions
  try {
    const res = await axios.get(`${API_BASE}/founder/institutes`, { headers: teacherHeaders });
    auditResults.push({
      category: 'RBAC & Privilege Escalation',
      testCase: 'Teacher access Founder institutes endpoint',
      expected: '403 Forbidden',
      actual: `Status ${res.status}`,
      status: 'SECURITY_FINDING',
      severity: 'CRITICAL',
      details: 'Teacher could access cross-tenant founder institutes',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'RBAC & Privilege Escalation',
      testCase: 'Teacher access Founder institutes endpoint',
      expected: '403 Forbidden',
      actual: `Status ${status}`,
      status: status === 403 ? 'PASS' : 'FAIL',
    });
  }

  // 6. RBAC: Admin attempting Founder actions
  try {
    const res = await axios.get(`${API_BASE}/founder/institutes`, { headers: adminHeaders });
    auditResults.push({
      category: 'RBAC & Privilege Escalation',
      testCase: 'Institute Admin access Founder institutes endpoint',
      expected: '403 Forbidden',
      actual: `Status ${res.status}`,
      status: 'SECURITY_FINDING',
      severity: 'CRITICAL',
      details: 'Institute Admin could access platform-wide founder institutes',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'RBAC & Privilege Escalation',
      testCase: 'Institute Admin access Founder institutes endpoint',
      expected: '403 Forbidden',
      actual: `Status ${status}`,
      status: status === 403 ? 'PASS' : 'FAIL',
    });
  }

  // 7. Founder accessing Founder institutes
  try {
    const res = await axios.get(`${API_BASE}/founder/institutes`, { headers: founderHeaders });
    auditResults.push({
      category: 'RBAC & Privilege Escalation',
      testCase: 'Founder access Founder institutes endpoint',
      expected: '200 OK',
      actual: `Status ${res.status}, Count: ${res.data?.data?.length ?? res.data?.length ?? 'OK'}`,
      status: res.status === 200 ? 'PASS' : 'FAIL',
    });
  } catch (err: any) {
    auditResults.push({
      category: 'RBAC & Privilege Escalation',
      testCase: 'Founder access Founder institutes endpoint',
      expected: '200 OK',
      actual: `Failed: ${err.message}`,
      status: 'FAIL',
    });
  }

  // 8. Tenant Boundary Isolation: Apex Admin attempting to query Zenith Global Institute data
  try {
    // Attempt to access foreign institute batches directly
    const res = await axios.get(`${API_BASE}/institutes/demo-institute-2/batches`, { headers: adminHeaders });
    auditResults.push({
      category: 'Tenant Isolation',
      testCase: 'Apex Admin accessing foreign institute (demo-institute-2) batches',
      expected: '403 Forbidden',
      actual: `Status ${res.status} (Allowed!)`,
      status: 'SECURITY_FINDING',
      severity: 'CRITICAL',
      details: 'Apex Admin was able to read batches of Zenith Global Institute (demo-institute-2)',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'Tenant Isolation',
      testCase: 'Apex Admin accessing foreign institute (demo-institute-2) batches',
      expected: '403 Forbidden',
      actual: `Status ${status} (${err.response?.data?.message || 'Access Denied'})`,
      status: status === 403 ? 'PASS' : 'FAIL',
    });
  }

  // 10. IDOR: Student attempting to access a document ID they do not own
  try {
    const res = await axios.get(`${API_BASE}/institutes/demo-institute-1/documents/non-owned-doc-id-123`, { headers: studentHeaders });
    auditResults.push({
      category: 'IDOR & Access Control',
      testCase: 'Student accessing unowned document by ID',
      expected: '403 Forbidden or 404 Not Found',
      actual: `Status ${res.status} (Allowed)`,
      status: 'SECURITY_FINDING',
      severity: 'HIGH',
      details: 'Student was allowed to access document without ownership check',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'IDOR & Access Control',
      testCase: 'Student accessing unowned document by ID',
      expected: '403 Forbidden or 404 Not Found',
      actual: `Status ${status} (${err.response?.data?.message || 'Access Denied'})`,
      status: (status === 403 || status === 404) ? 'PASS' : 'FAIL',
    });
  }

  // 11. SQL Injection Probe: Query parameter with SQL meta-characters
  try {
    const sqlPayload = "' OR '1'='1' -- ";
    const res = await axios.get(`${API_BASE}/institutes/demo-institute-1/exams?search=${encodeURIComponent(sqlPayload)}`, { headers: teacherHeaders });
    auditResults.push({
      category: 'Injection Defense',
      testCase: 'SQL Injection probe in search parameter',
      expected: 'Safe query execution (parameterized via Prisma) or validation rejection',
      actual: `Status ${res.status}, returned ${res.data?.data?.length ?? 0} results safely`,
      status: res.status === 200 ? 'PASS' : 'FAIL',
    });
  } catch (err: any) {
    const status = err.response?.status;
    auditResults.push({
      category: 'Injection Defense',
      testCase: 'SQL Injection probe in search parameter',
      expected: 'Safe handling or 400 validation error',
      actual: `Status ${status}`,
      status: (status === 400 || status === 422) ? 'PASS' : 'FAIL',
    });
  }

  console.log('\n============================================================');
  console.log('                 SECURITY AUDIT RESULTS SUMMARY              ');
  console.log('============================================================\n');

  for (const r of auditResults) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'SECURITY_FINDING' ? '🚨' : '❌';
    console.log(`${icon} [${r.category}] ${r.testCase}`);
    console.log(`   Expected: ${r.expected}`);
    console.log(`   Actual:   ${r.actual}`);
    if (r.details) console.log(`   Details:  ${r.details}`);
    if (r.severity) console.log(`   Severity: ${r.severity}`);
    console.log('');
  }

  const passCount = auditResults.filter(r => r.status === 'PASS').length;
  const failCount = auditResults.filter(r => r.status === 'FAIL').length;
  const findingCount = auditResults.filter(r => r.status === 'SECURITY_FINDING').length;

  console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED, ${findingCount} SECURITY FINDINGS (Total ${auditResults.length})`);
}

runSecurityAudit().catch(console.error);
