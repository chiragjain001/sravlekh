import { createHash } from 'crypto';

/**
 * 09-CACHING-STRATEGY.md.
 * Centralized cache key generator functions for AIOS.
 *
 * Guarantees:
 *  1. Strict multi-tenant isolation (instituteId prefix on all tenant-owned state)
 *  2. PII protection (SHA-256 hashing on emails for allowlists and lockout counters)
 *  3. Single source of truth for key formats and prefix-based invalidation
 */

// ── AUTH & SESSIONS ──────────────────────────────────────────────────────────

export function allowlistCheckKey(email: string): string {
  return `allowlist-check:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

export function loginFailureCountKey(email: string): string {
  return `login-fail:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

export function loginLockoutKey(email: string): string {
  return `login-lock:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

export function jwtUserCacheKey(userId: string, tokenVersion: number, impersonatorId?: string): string {
  return impersonatorId
    ? `auth:user:${userId}:${tokenVersion}:imp:${impersonatorId}`
    : `auth:user:${userId}:${tokenVersion}`;
}

export function jwtUserCachePrefix(userId: string): string {
  return `auth:user:${userId}:`;
}

// ── INSTITUTES & TENANCY ─────────────────────────────────────────────────────

export function instituteProfileKey(instituteId: string): string {
  return `institute:${instituteId}:profile`;
}

export function institutePrefix(instituteId: string): string {
  return `institute:${instituteId}:`;
}

// ── BATCHES & ACADEMIC STRUCTURE ─────────────────────────────────────────────

export function batchesListKey(instituteId: string, scope: string): string {
  return `batches:${instituteId}:${scope}`;
}

export function batchesListPrefix(instituteId: string): string {
  return `batches:${instituteId}:`;
}

export function batchesStatsKey(instituteId: string, scope: string): string {
  return `batches-stats:${instituteId}:${scope}`;
}

export function batchesStatsPrefix(instituteId: string): string {
  return `batches-stats:${instituteId}:`;
}

export function batchPerfSummaryKey(instituteId: string, scope: string): string {
  return `batch-perf-summary:${instituteId}:${scope}`;
}

export function academicsTreeKey(instituteId: string): string {
  return `academics-tree:${instituteId}`;
}

// ── STUDENTS & ROSTERS ───────────────────────────────────────────────────────

export function studentsStatsKey(instituteId: string, scope: string): string {
  return `students-stats:${instituteId}:${scope}`;
}

export function studentsStatsPrefix(instituteId: string): string {
  return `students-stats:${instituteId}:`;
}

// ── TEACHERS ─────────────────────────────────────────────────────────────────

export function teacherProfileKey(instituteId: string, teacherUserId: string): string {
  return `teacher-profile:${instituteId}:${teacherUserId}`;
}

export function teacherBatchCacheKey(teacherUserId: string): string {
  return `teacher-batches:${teacherUserId}`;
}

// ── QUESTIONS ────────────────────────────────────────────────────────────────

export function questionBankPrefix(instituteId: string): string {
  return `questions:${instituteId}:`;
}

export function questionBankKey(instituteId: string, queryHashOrKey: string): string {
  return `questions:${instituteId}:${queryHashOrKey}`;
}

// ── TIMETABLE ────────────────────────────────────────────────────────────────

export function timetablePrefix(instituteId: string): string {
  return `timetable:${instituteId}:`;
}

export function timetableKey(instituteId: string, criteriaKey: string): string {
  return `timetable:${instituteId}:${criteriaKey}`;
}

// ── FEATURE FLAGS ────────────────────────────────────────────────────────────

export function featureFlagCacheKey(instituteId: string, flag: string): string {
  return `ff:${instituteId}:${flag}`;
}
