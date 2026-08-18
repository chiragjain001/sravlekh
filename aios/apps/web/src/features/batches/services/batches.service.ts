// ─── Batches Service Layer ────────────────────────────────────────────────────
// Isolated service abstraction for Batch CRUD operations.

import type {
  BatchListItem,
  BatchProfile,
  BatchesAnalytics,
  GetBatchesParams,
  CreateBatchInput,
  UpdateBatchInput,
  PaginatedBatches,
} from '../types/batch.types';

import {
  MOCK_BATCHES,
  MOCK_BATCHES_ANALYTICS,
  buildBatchProfile,
} from '../mock/batches.mock';

const delay = (ms = 500) => new Promise<void>((r) => setTimeout(r, ms));

let _idCounter = MOCK_BATCHES.length + 1;
function nextId(): string {
  return `b-${String(_idCounter++).padStart(3, '0')}`;
}

let _store: BatchListItem[] = [...MOCK_BATCHES];

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getBatches(params: GetBatchesParams = {}): Promise<PaginatedBatches> {
  await delay(400);

  const {
    page       = 1,
    pageSize   = 10,
    search     = '',
    program,
    targetYear,
    status,
    sortBy     = 'name',
    sortDir    = 'asc',
  } = params;

  let filtered = [..._store];

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.leadMentor.toLowerCase().includes(q) ||
        b.program.toLowerCase().includes(q),
    );
  }

  if (program)    filtered = filtered.filter((b) => b.program === program);
  if (targetYear) filtered = filtered.filter((b) => b.targetYear === targetYear);
  if (status)     filtered = filtered.filter((b) => b.status === status);

  filtered.sort((a, b) => {
    const aVal = a[sortBy as keyof BatchListItem];
    const bVal = b[sortBy as keyof BatchListItem];
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

export async function getBatchById(id: string): Promise<BatchListItem> {
  await delay(300);
  const batch = _store.find((b) => b.id === id);
  if (!batch) throw new Error(`Batch with id "${id}" not found.`);
  return { ...batch };
}

export async function getBatchProfile(id: string): Promise<BatchProfile> {
  await delay(600);
  const base = _store.find((b) => b.id === id);
  if (!base) throw new Error(`Batch profile "${id}" not found.`);
  return buildBatchProfile(base);
}

export async function getBatchesAnalytics(): Promise<BatchesAnalytics> {
  await delay(500);
  return { ...MOCK_BATCHES_ANALYTICS };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function createBatch(input: CreateBatchInput): Promise<BatchListItem> {
  await delay(700);

  const newBatch: BatchListItem = {
    id:               nextId(),
    code:             input.code ?? `B-${input.program}-${input.targetYear}-${Date.now().toString().slice(-2)}`,
    name:             input.name,
    program:          input.program,
    targetYear:       input.targetYear,
    branchName:       'Main Campus',
    enrolledStudents: 0,
    maxCapacity:      input.maxCapacity,
    leadMentor:       input.leadMentor,
    mentorAvatar:     input.leadMentor.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
    facultyCount:     3,
    attendancePct:    0,
    avgScore:         0,
    syllabusProgress: 0,
    nextTestName:     'Orientation Quiz',
    nextTestDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status:           'active',
    startDate:        input.startDate ?? new Date().toISOString().slice(0, 10),
    endDate:          input.endDate   ?? `${input.targetYear}-05-30`,
  };

  _store = [newBatch, ..._store];
  return newBatch;
}

export async function updateBatch(input: UpdateBatchInput): Promise<BatchListItem> {
  await delay(600);

  const idx = _store.findIndex((b) => b.id === input.id);
  if (idx === -1) throw new Error(`Batch "${input.id}" not found.`);

  const current = _store[idx];
  if (!current) throw new Error(`Batch "${input.id}" not found.`);

  const updated: BatchListItem = {
    ...current,
    name:        input.name        ?? current.name,
    program:     input.program     ?? current.program,
    targetYear:  input.targetYear  ?? current.targetYear,
    maxCapacity: input.maxCapacity ?? current.maxCapacity,
    leadMentor:  input.leadMentor  ?? current.leadMentor,
    status:      input.status      ?? current.status,
  };

  _store = [..._store.slice(0, idx), updated, ..._store.slice(idx + 1)];
  return updated;
}

export async function deleteBatch(id: string): Promise<void> {
  await delay(500);
  const idx = _store.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error(`Batch "${id}" not found.`);
  _store = _store.map((b) => (b.id === id ? { ...b, status: 'archived' } : b));
}

export async function bulkDeleteBatches(ids: string[]): Promise<void> {
  await delay(700);
  _store = _store.map((b) => (ids.includes(b.id) ? { ...b, status: 'archived' } : b));
}

export async function exportBatches(ids?: string[]): Promise<string> {
  await delay(800);
  const subset = ids?.length ? _store.filter((b) => ids.includes(b.id)) : _store;
  const header = 'Batch Code,Name,Program,Year,Students,Capacity,Mentor,Attendance%,Avg Score%,Progress%,Status';
  const rows   = subset.map((b) =>
    [b.code, b.name, b.program, b.targetYear, b.enrolledStudents, b.maxCapacity,
     b.leadMentor, b.attendancePct, b.avgScore, b.syllabusProgress, b.status].join(','),
  );
  return [header, ...rows].join('\n');
}
