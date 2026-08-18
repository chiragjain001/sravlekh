// ─── Timetable Service Layer ───────────────────────────────────────────────────

import type {
  ClassSessionItem,
  TimetableGridRow,
  TimetableAnalytics,
  GetTimetableParams,
  CreateSessionInput,
  UpdateSessionInput,
} from '../types/timetable.types';

import {
  DAYS_HEADER,
  MOCK_TIMETABLE_GRID,
  MOCK_TIMETABLE_ANALYTICS,
} from '../mock/timetable.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let _gridStore: TimetableGridRow[] = JSON.parse(JSON.stringify(MOCK_TIMETABLE_GRID));
let _analyticsStore: TimetableAnalytics = JSON.parse(JSON.stringify(MOCK_TIMETABLE_ANALYTICS));

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getTimetableMatrix(params: GetTimetableParams = {}): Promise<{
  days: typeof DAYS_HEADER;
  rows: TimetableGridRow[];
}> {
  await delay(350);

  const { batch, subject, teacher, room, search } = params;

  let filteredRows = _gridStore.map((row) => {
    const filterCell = (cell: ClassSessionItem | null): ClassSessionItem | null => {
      if (!cell) return null;
      if (batch   && !cell.batch.toLowerCase().includes(batch.toLowerCase())) return null;
      if (subject && !cell.subject.toLowerCase().includes(subject.toLowerCase())) return null;
      if (teacher && !cell.facultyName.toLowerCase().includes(teacher.toLowerCase())) return null;
      if (room    && !cell.room.toLowerCase().includes(room.toLowerCase())) return null;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          cell.batch.toLowerCase().includes(q) ||
          cell.subject.toLowerCase().includes(q) ||
          cell.facultyName.toLowerCase().includes(q) ||
          cell.room.toLowerCase().includes(q);
        if (!matches) return null;
      }
      return cell;
    };

    return {
      time: row.time,
      mon:  filterCell(row.mon),
      tue:  filterCell(row.tue),
      wed:  filterCell(row.wed),
      thu:  filterCell(row.thu),
      fri:  filterCell(row.fri),
      sat:  filterCell(row.sat),
      sun:  filterCell(row.sun),
    };
  });

  return { days: DAYS_HEADER, rows: filteredRows };
}

export async function getFlatSessionList(): Promise<ClassSessionItem[]> {
  await delay(300);
  const list: ClassSessionItem[] = [];
  _gridStore.forEach((r) => {
    [r.mon, r.tue, r.wed, r.thu, r.fri, r.sat, r.sun].forEach((cell) => {
      if (cell) list.push(cell);
    });
  });
  return list;
}

export async function getTimetableAnalytics(): Promise<TimetableAnalytics> {
  await delay(400);
  return { ..._analyticsStore };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function createSession(input: CreateSessionInput): Promise<ClassSessionItem> {
  await delay(500);

  const newSession: ClassSessionItem = {
    id:          `s-${Date.now()}`,
    timeSlot:    input.timeSlot,
    day:         input.day,
    subject:     input.subject,
    batch:       input.batch,
    room:        input.room,
    facultyName: input.facultyName,
    color:       'bg-blue-50 border-blue-200 text-blue-800',
    status:      'scheduled',
  };

  const dayKey = input.day.toLowerCase() as keyof TimetableGridRow;
  let targetRow = _gridStore.find((r) => r.time === input.timeSlot);

  if (!targetRow) {
    targetRow = {
      time: input.timeSlot,
      mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
    };
    _gridStore.push(targetRow);
  }

  (targetRow as any)[dayKey] = newSession;
  return newSession;
}

export async function updateSession(input: UpdateSessionInput): Promise<ClassSessionItem> {
  await delay(450);

  let updated: ClassSessionItem | null = null;

  _gridStore = _gridStore.map((r) => {
    const keys: (keyof TimetableGridRow)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    keys.forEach((k) => {
      const cell = r[k] as ClassSessionItem | null;
      if (cell && cell.id === input.id) {
        updated = {
          ...cell,
          subject:     input.subject     ?? cell.subject,
          batch:       input.batch       ?? cell.batch,
          room:        input.room        ?? cell.room,
          facultyName: input.facultyName ?? cell.facultyName,
          status:      input.status      ?? cell.status,
        };
        (r as any)[k] = updated;
      }
    });
    return r;
  });

  if (!updated) throw new Error(`Session "${input.id}" not found.`);
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await delay(400);

  _gridStore = _gridStore.map((r) => {
    const keys: (keyof TimetableGridRow)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    keys.forEach((k) => {
      const cell = r[k] as ClassSessionItem | null;
      if (cell && cell.id === id) {
        (r as any)[k] = null;
      }
    });
    return r;
  });
}

export async function assignSubstitute(sessionId: string, substituteFaculty: string): Promise<void> {
  await delay(500);
  await updateSession({ id: sessionId, facultyName: substituteFaculty, status: 'substituted' });
}

export async function resolveConflict(alertId: string): Promise<void> {
  await delay(400);
  _analyticsStore.scheduleAlerts = _analyticsStore.scheduleAlerts.filter((a) => a.id !== alertId);
}
