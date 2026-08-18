// ─── Exams Service Layer ───────────────────────────────────────────────────────
// Isolated service abstraction for Exam CRUD operations.

import type {
  ExamListItem,
  ExamProfile,
  ExamsAnalytics,
  GetExamsParams,
  CreateExamInput,
  UpdateExamInput,
  PaginatedExams,
} from '../types/exam.types';

import {
  MOCK_EXAMS,
  MOCK_EXAMS_ANALYTICS,
  buildExamProfile,
} from '../mock/exams.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let _idCounter = MOCK_EXAMS.length + 1;
function nextId(): string {
  return `ex-${String(_idCounter++).padStart(3, '0')}`;
}

let _store: ExamListItem[] = [...MOCK_EXAMS];

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getExams(params: GetExamsParams = {}): Promise<PaginatedExams> {
  await delay(400);

  const {
    page     = 1,
    pageSize = 10,
    search   = '',
    type,
    status,
    batch,
    sortBy   = 'date',
    sortDir  = 'asc',
  } = params;

  let filtered = [..._store];

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.batch.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q),
    );
  }

  if (type)   filtered = filtered.filter((e) => e.type === type);
  if (status) filtered = filtered.filter((e) => e.status === status);
  if (batch)  filtered = filtered.filter((e) => e.batch.toLowerCase().includes(batch.toLowerCase()));

  filtered.sort((a, b) => {
    const aVal = a[sortBy as keyof ExamListItem];
    const bVal = b[sortBy as keyof ExamListItem];
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

export async function getExamById(id: string): Promise<ExamListItem> {
  await delay(300);
  const item = _store.find((e) => e.id === id);
  if (!item) throw new Error(`Exam with id "${id}" not found.`);
  return { ...item };
}

export async function getExamProfile(id: string): Promise<ExamProfile> {
  await delay(500);
  const base = _store.find((e) => e.id === id);
  if (!base) throw new Error(`Exam profile "${id}" not found.`);
  return buildExamProfile(base);
}

export async function getExamsAnalytics(): Promise<ExamsAnalytics> {
  await delay(400);
  return { ...MOCK_EXAMS_ANALYTICS };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function createExam(input: CreateExamInput): Promise<ExamListItem> {
  await delay(600);

  const newExam: ExamListItem = {
    id:       nextId(),
    code:     input.code ?? `EX-${Date.now().toString().slice(-4)}`,
    name:     input.name,
    batch:    input.batch,
    type:     input.type,
    date:     input.date,
    duration: input.duration,
    students: input.students ?? 100,
    status:   'Upcoming',
    maxMarks: input.maxMarks ?? 300,
    avgScore: 0,
    passRate: 0,
  };

  _store = [newExam, ..._store];
  return newExam;
}

export async function updateExam(input: UpdateExamInput): Promise<ExamListItem> {
  await delay(500);

  const idx = _store.findIndex((e) => e.id === input.id);
  if (idx === -1) throw new Error(`Exam "${input.id}" not found.`);

  const current = _store[idx];
  if (!current) throw new Error(`Exam "${input.id}" not found.`);

  const updated: ExamListItem = {
    ...current,
    name:     input.name     ?? current.name,
    batch:    input.batch    ?? current.batch,
    type:     input.type     ?? current.type,
    date:     input.date     ?? current.date,
    duration: input.duration ?? current.duration,
    status:   input.status   ?? current.status,
  };

  _store = [..._store.slice(0, idx), updated, ..._store.slice(idx + 1)];
  return updated;
}

export async function deleteExam(id: string): Promise<void> {
  await delay(500);
  _store = _store.map((e) => (e.id === id ? { ...e, status: 'Cancelled' } : e));
}

export async function bulkDeleteExams(ids: string[]): Promise<void> {
  await delay(600);
  _store = _store.map((e) => (ids.includes(e.id) ? { ...e, status: 'Cancelled' } : e));
}

export async function exportExams(ids?: string[]): Promise<string> {
  await delay(700);
  const subset = ids?.length ? _store.filter((e) => ids.includes(e.id)) : _store;
  const header = 'Code,Exam Name,Batch,Type,Date,Duration,Candidates,Status,Max Marks,Avg Score%';
  const rows   = subset.map((e) =>
    [e.code, e.name, e.batch, e.type, e.date, e.duration, e.students, e.status, e.maxMarks, e.avgScore].join(','),
  );
  return [header, ...rows].join('\n');
}
