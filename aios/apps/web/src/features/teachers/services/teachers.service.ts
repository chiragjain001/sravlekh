// ─── Teachers Service Layer ───────────────────────────────────────────────────
// Isolated service abstraction for all Teacher CRUD operations.

import type {
  TeacherListItem,
  TeacherProfile,
  TeachersAnalytics,
  GetTeachersParams,
  CreateTeacherInput,
  UpdateTeacherInput,
  PaginatedTeachers,
} from '../types/teacher.types';

import {
  MOCK_TEACHERS,
  MOCK_TEACHERS_ANALYTICS,
  buildTeacherProfile,
} from '../mock/teachers.mock';

const delay = (ms = 500) => new Promise<void>((r) => setTimeout(r, ms));

let _idCounter = MOCK_TEACHERS.length + 1;
function nextId(): string {
  return `tch-${String(_idCounter++).padStart(3, '0')}`;
}

let _store: TeacherListItem[] = [...MOCK_TEACHERS];

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getTeachers(params: GetTeachersParams = {}): Promise<PaginatedTeachers> {
  await delay(400);

  const {
    page         = 1,
    pageSize     = 10,
    search       = '',
    subject,
    availability,
    status,
    sortBy       = 'name',
    sortDir      = 'asc',
  } = params;

  let filtered = [..._store];

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.empId.toLowerCase().includes(q),
    );
  }

  if (subject)      filtered = filtered.filter((t) => t.subject === subject);
  if (availability) filtered = filtered.filter((t) => t.availability === availability);
  if (status)       filtered = filtered.filter((t) => t.status === status);

  filtered.sort((a, b) => {
    const aVal = a[sortBy as keyof TeacherListItem];
    const bVal = b[sortBy as keyof TeacherListItem];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const total      = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start      = (page - 1) * pageSize;
  const data       = filtered.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages };
}

export async function getTeacherById(id: string): Promise<TeacherListItem> {
  await delay(300);
  const teacher = _store.find((t) => t.id === id);
  if (!teacher) throw new Error(`Teacher with id "${id}" not found.`);
  return { ...teacher };
}

export async function getTeacherProfile(id: string): Promise<TeacherProfile> {
  await delay(600);
  const base = _store.find((t) => t.id === id);
  if (!base) throw new Error(`Teacher profile "${id}" not found.`);
  return buildTeacherProfile(base);
}

export async function getTeachersAnalytics(): Promise<TeachersAnalytics> {
  await delay(500);
  return { ...MOCK_TEACHERS_ANALYTICS };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function createTeacher(input: CreateTeacherInput): Promise<TeacherListItem> {
  await delay(700);

  const newTeacher: TeacherListItem = {
    id:                 nextId(),
    empId:              input.empId ?? `EMP${Date.now().toString().slice(-4)}`,
    name:               input.name,
    email:              input.email,
    phone:              input.phone,
    avatarInitials:     input.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
    designation:        input.designation ?? 'Faculty',
    role:               input.role ?? 'teacher',
    subject:            input.subject,
    subjects:           input.subjects ?? [input.subject],
    assignedBatches:    0,
    batchLabels:        [],
    weeklyClasses:      0,
    pendingEvaluations: 0,
    avgStudentScore:    0,
    workloadPct:        0,
    availability:       'available',
    rating:             5.0,
    joinedOn:           new Date().toISOString(),
    status:             'active',
  };

  _store = [newTeacher, ..._store];
  return newTeacher;
}

export async function updateTeacher(input: UpdateTeacherInput): Promise<TeacherListItem> {
  await delay(600);

  const idx = _store.findIndex((t) => t.id === input.id);
  if (idx === -1) throw new Error(`Teacher "${input.id}" not found.`);

  const current = _store[idx];
  if (!current) throw new Error(`Teacher "${input.id}" not found.`);

  const updated: TeacherListItem = {
    ...current,
    name:         input.name        ?? current.name,
    email:        input.email       ?? current.email,
    phone:        input.phone       ?? current.phone,
    subject:      input.subject     ?? current.subject,
    subjects:     input.subjects    ?? current.subjects,
    designation:  input.designation ?? current.designation,
    role:         input.role        ?? current.role,
    availability: input.availability?? current.availability,
    status:       input.status      ?? current.status,
  };

  _store = [..._store.slice(0, idx), updated, ..._store.slice(idx + 1)];
  return updated;
}

export async function deleteTeacher(id: string): Promise<void> {
  await delay(500);
  const idx = _store.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Teacher "${id}" not found.`);
  _store = _store.map((t) => (t.id === id ? { ...t, status: 'inactive' } : t));
}

export async function bulkDeleteTeachers(ids: string[]): Promise<void> {
  await delay(700);
  _store = _store.map((t) => (ids.includes(t.id) ? { ...t, status: 'inactive' } : t));
}

export async function exportTeachers(ids?: string[]): Promise<string> {
  await delay(800);
  const subset = ids?.length ? _store.filter((t) => ids.includes(t.id)) : _store;
  const header = 'Emp ID,Name,Email,Phone,Subject,Batches,Weekly Hrs,Rating,Workload%,Availability,Status';
  const rows   = subset.map((t) =>
    [t.empId, t.name, t.email, t.phone, t.subject, t.assignedBatches,
     t.weeklyClasses, t.rating, t.workloadPct, t.availability, t.status].join(','),
  );
  return [header, ...rows].join('\n');
}
