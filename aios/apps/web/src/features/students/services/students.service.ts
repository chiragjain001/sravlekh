// ─── Students Service Layer ───────────────────────────────────────────────────
// Every component in the Students Module calls THIS file — never mock data directly.
// To connect a real API later: replace the mock* imports and swap implementations.
// The function signatures, return types, and error contract stay identical.

import type {
  StudentListItem,
  StudentProfile,
  StudentsAnalytics,
  GetStudentsParams,
  CreateStudentInput,
  UpdateStudentInput,
  PaginatedStudents,
} from '../types/student.types';

import {
  MOCK_STUDENTS,
  MOCK_STUDENTS_ANALYTICS,
  buildStudentProfile,
} from '../mock/students.mock';

// ── Simulated network delay (remove when connecting real API)
const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

// ── Deterministic ID generator (replace with backend UUID)
let _idCounter = MOCK_STUDENTS.length + 1;
function nextId(): string {
  return `st-${String(_idCounter++).padStart(3, '0')}`;
}

// ── In-memory mutable store (simulates DB)
let _store: StudentListItem[] = [...MOCK_STUDENTS];

// ─────────────────────────────────────────────────────────────────────────────
//  READ operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paginated, filtered, sorted student list.
 * Mirrors: GET /api/admin/students?page=1&pageSize=20&search=...
 */
export async function getStudents(params: GetStudentsParams = {}): Promise<PaginatedStudents> {
  await delay(500);

  const {
    page      = 1,
    pageSize  = 10,
    search    = '',
    program,
    batch,
    status,
    feeStatus,
    riskLevel,
    sortBy    = 'name',
    sortDir   = 'asc',
  } = params;

  let filtered = [..._store];

  // ── Search
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q),
    );
  }

  // ── Filters
  if (program)   filtered = filtered.filter((s) => s.program === program);
  if (batch)     filtered = filtered.filter((s) => s.batchLabel.includes(batch));
  if (status)    filtered = filtered.filter((s) => s.status === status);
  if (feeStatus) filtered = filtered.filter((s) => s.feeStatus === feeStatus);
  if (riskLevel) filtered = filtered.filter((s) => s.riskLevel === riskLevel);

  // ── Sort
  filtered.sort((a, b) => {
    const aVal = a[sortBy as keyof StudentListItem];
    const bVal = b[sortBy as keyof StudentListItem];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // ── Paginate
  const total      = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start      = (page - 1) * pageSize;
  const data       = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

/**
 * Fetch single student by ID.
 * Mirrors: GET /api/admin/students/:id
 */
export async function getStudentById(id: string): Promise<StudentListItem> {
  await delay(300);
  const student = _store.find((s) => s.id === id);
  if (!student) throw new Error(`Student with id "${id}" not found.`);
  return { ...student };
}

/**
 * Fetch full student profile (includes history, analytics, timeline).
 * Mirrors: GET /api/admin/students/:id/profile
 */
export async function getStudentProfile(id: string): Promise<StudentProfile> {
  await delay(700);
  const base = _store.find((s) => s.id === id);
  if (!base) throw new Error(`Student profile "${id}" not found.`);
  return buildStudentProfile(base);
}

/**
 * Students analytics aggregates.
 * Mirrors: GET /api/admin/students/analytics
 */
export async function getStudentsAnalytics(): Promise<StudentsAnalytics> {
  await delay(600);
  return { ...MOCK_STUDENTS_ANALYTICS };
}

// ─────────────────────────────────────────────────────────────────────────────
//  WRITE operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enroll a new student.
 * Mirrors: POST /api/admin/students
 */
export async function createStudent(input: CreateStudentInput): Promise<StudentListItem> {
  await delay(800);

  const newStudent: StudentListItem = {
    id:              nextId(),
    rollNo:          input.rollNo ?? `AOS${Date.now().toString().slice(-6)}`,
    name:            input.name,
    email:           input.email,
    phone:           input.phone,
    avatarInitials:  input.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
    program:         input.program,
    batchId:         input.batchId,
    batchLabel:      'New Batch', // resolved server-side normally
    classLabel:      'Class 12',
    avgScore:        0,
    attendancePct:   0,
    weakTopicsCount: 0,
    rank:            null,
    lastActiveAt:    new Date().toISOString(),
    feeStatus:       'partial',
    riskLevel:       'low',
    status:          'active',
    parentName:      input.parentName ?? null,
    parentPhone:     input.parentPhone ?? null,
    enrolledAt:      new Date().toISOString(),
  };

  _store = [newStudent, ..._store];
  return newStudent;
}

/**
 * Update a student record.
 * Mirrors: PATCH /api/admin/students/:id
 */
export async function updateStudent(input: UpdateStudentInput): Promise<StudentListItem> {
  await delay(700);

  const idx = _store.findIndex((s) => s.id === input.id);
  if (idx === -1) throw new Error(`Student "${input.id}" not found.`);

  const current = _store[idx];
  if (!current) throw new Error(`Student "${input.id}" not found.`);

  const updated: StudentListItem = {
    ...current,
    name:        input.name        ?? current.name,
    email:       input.email       ?? current.email,
    phone:       input.phone       ?? current.phone,
    rollNo:      input.rollNo      ?? current.rollNo,
    program:     input.program     ?? current.program,
    batchId:     input.batchId     ?? current.batchId,
    parentName:  input.parentName  !== undefined ? input.parentName  : current.parentName,
    parentPhone: input.parentPhone !== undefined ? input.parentPhone : current.parentPhone,
    status:      input.status      ?? current.status,
  };
  _store = [..._store.slice(0, idx), updated, ..._store.slice(idx + 1)];
  return updated;
}

/**
 * Delete (or soft-delete) a student.
 * Mirrors: DELETE /api/admin/students/:id
 */
export async function deleteStudent(id: string): Promise<void> {
  await delay(500);
  const idx = _store.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`Student "${id}" not found.`);
  // Soft-delete: set status to inactive
  _store = _store.map((s) => (s.id === id ? { ...s, status: 'inactive' } : s));
}

/**
 * Bulk delete students.
 * Mirrors: DELETE /api/admin/students (body: { ids: string[] })
 */
export async function bulkDeleteStudents(ids: string[]): Promise<void> {
  await delay(800);
  _store = _store.map((s) => (ids.includes(s.id) ? { ...s, status: 'inactive' } : s));
}

// ─────────────────────────────────────────────────────────────────────────────
//  IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export students as CSV string.
 * Mirrors: GET /api/admin/students/export?format=csv
 */
export async function exportStudents(ids?: string[]): Promise<string> {
  await delay(1000);

  const subset = ids?.length ? _store.filter((s) => ids.includes(s.id)) : _store;
  const header = 'Roll No,Name,Email,Phone,Program,Batch,Avg Score,Attendance%,Fee Status,Risk Level';
  const rows   = subset.map((s) =>
    [s.rollNo, s.name, s.email, s.phone, s.program, s.batchLabel,
     s.avgScore, s.attendancePct, s.feeStatus, s.riskLevel].join(','),
  );
  return [header, ...rows].join('\n');
}

/**
 * Import students from parsed CSV rows.
 * Mirrors: POST /api/admin/students/import (multipart CSV)
 */
export async function importStudents(
  rows: Omit<CreateStudentInput, 'enrolledExams'>[],
): Promise<{ imported: number; failed: number; errors: string[] }> {
  await delay(1500);

  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.name || !row.email) {
      errors.push(`Row missing name/email: ${JSON.stringify(row)}`);
      continue;
    }
    await createStudent({ ...row, enrolledExams: [] });
    imported++;
  }

  return { imported, failed: errors.length, errors };
}
