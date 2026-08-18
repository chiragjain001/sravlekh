// ─── URL ↔ AcademicContext Sync ───────────────────────────────────────────────
// Canonical parser/serializer for URL search params ↔ AcademicContext.
// Every deep link, notification click, and browser back uses this.
//
// URL format: /dashboard/teacher?nav=classes&batch=11A&tab=students&student=STU-001

import type { AcademicContext, BatchTab } from '@/types/academic-context.types';
import type { TeacherTopNav } from '@/store/teacher-store';

// ── URL param key names (short, readable in the URL bar)
export const URL_PARAM_MAP = {
  nav:      'nav',       // TeacherTopNav
  classId:  'class',
  batchId:  'batch',
  subjectId:'subject',
  examId:   'exam',
  studentId:'student',
  testId:   'test',
  assignmentId: 'assignment',
  doubtId:  'doubt',
  paperId:  'paper',
  tab:      'tab',       // BatchTab
} as const;

export type UrlParamKey = keyof typeof URL_PARAM_MAP;

/**
 * Parse URLSearchParams into a partial AcademicContext patch.
 * Used on mount to restore context from a deep link.
 */
export function parseUrlToContextPatch(
  searchParams: URLSearchParams
): Partial<AcademicContext> {
  const patch: Partial<AcademicContext> = {};

  const classId = searchParams.get(URL_PARAM_MAP.classId);
  if (classId) patch.classId = classId;

  const batchId = searchParams.get(URL_PARAM_MAP.batchId);
  if (batchId) patch.batchId = batchId;

  const subjectId = searchParams.get(URL_PARAM_MAP.subjectId);
  if (subjectId) patch.subjectId = subjectId;

  const examId = searchParams.get(URL_PARAM_MAP.examId);
  if (examId) patch.examId = examId;

  const studentId = searchParams.get(URL_PARAM_MAP.studentId);
  if (studentId) patch.studentId = studentId;

  const testId = searchParams.get(URL_PARAM_MAP.testId);
  if (testId) patch.testId = testId;

  const assignmentId = searchParams.get(URL_PARAM_MAP.assignmentId);
  if (assignmentId) patch.assignmentId = assignmentId;

  const doubtId = searchParams.get(URL_PARAM_MAP.doubtId);
  if (doubtId) patch.doubtId = doubtId;

  const paperId = searchParams.get(URL_PARAM_MAP.paperId);
  if (paperId) patch.paperId = paperId;

  const tab = searchParams.get(URL_PARAM_MAP.tab) as BatchTab | null;
  if (tab) patch.batchTab = tab;

  return patch;
}

/**
 * Serialize relevant AcademicContext fields into URLSearchParams.
 * Only includes non-null fields to keep URLs clean.
 */
export function contextToUrlParams(
  ctx: Partial<AcademicContext>,
  nav?: string
): URLSearchParams {
  const params = new URLSearchParams();

  if (nav) params.set(URL_PARAM_MAP.nav, nav);
  if (ctx.classId)      params.set(URL_PARAM_MAP.classId, ctx.classId);
  if (ctx.batchId)      params.set(URL_PARAM_MAP.batchId, ctx.batchId);
  if (ctx.subjectId)    params.set(URL_PARAM_MAP.subjectId, ctx.subjectId);
  if (ctx.examId)       params.set(URL_PARAM_MAP.examId, ctx.examId);
  if (ctx.studentId)    params.set(URL_PARAM_MAP.studentId, ctx.studentId);
  if (ctx.testId)       params.set(URL_PARAM_MAP.testId, ctx.testId);
  if (ctx.assignmentId) params.set(URL_PARAM_MAP.assignmentId, ctx.assignmentId);
  if (ctx.doubtId)      params.set(URL_PARAM_MAP.doubtId, ctx.doubtId);
  if (ctx.paperId)      params.set(URL_PARAM_MAP.paperId, ctx.paperId);
  if (ctx.batchTab && ctx.batchTab !== 'overview') {
    params.set(URL_PARAM_MAP.tab, ctx.batchTab);
  }

  return params;
}

/**
 * Build a deep link URL for a notification or external share.
 * Example: buildDeepLink('teacher', 'classes', { batchId: '11A', tab: 'tests' })
 */
export function buildDeepLink(
  role: string,
  nav: string,
  ctx: Partial<AcademicContext>
): string {
  const params = contextToUrlParams(ctx, nav);
  return `/dashboard/${role}?${params.toString()}`;
}
