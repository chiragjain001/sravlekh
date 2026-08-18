// ─── Academics Service Layer ───────────────────────────────────────────────────
// Isolated service abstraction for Academic Operations data.

import type { AcademicsAnalytics, GetAcademicsParams } from '../types/academic.types';
import { MOCK_ACADEMICS_DATA } from '../mock/academics.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

export async function getAcademicsAnalytics(params: GetAcademicsParams = {}): Promise<AcademicsAnalytics> {
  await delay(400);

  const { search = '', subject } = params;

  let data = { ...MOCK_ACADEMICS_DATA };

  if (subject) {
    data.subjectProgress = data.subjectProgress.filter(
      (s) => s.subject.toLowerCase() === subject.toLowerCase(),
    );
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    data.subjectProgress = data.subjectProgress.filter((s) => s.subject.toLowerCase().includes(q));
    data.doubtQueue      = data.doubtQueue.filter((d) => d.teacherName.toLowerCase().includes(q) || d.subject.toLowerCase().includes(q));
    data.teacherTasks    = data.teacherTasks.filter((t) => t.task.toLowerCase().includes(q) || t.teacherName.toLowerCase().includes(q));
  }

  return data;
}

export async function updateSyllabusProgress(subjectId: string, newProgress: number): Promise<void> {
  await delay(500);
  const target = MOCK_ACADEMICS_DATA.subjectProgress.find((s) => s.id === subjectId);
  if (target) {
    target.progress = newProgress;
  }
}
