// ─── Batches Feature: Types ────────────────────────────────────────────────────
// Real shapes only — mirrors apps/api/src/batches/dto/batch.dto.ts and the
// Batch Prisma model. No capacity/mentor/attendance%/syllabus-progress fields
// at the list level — those aren't real, cheap per-row aggregates.

export type SortDirection = 'asc' | 'desc';
export type BatchSortField = 'name' | 'classYear' | 'academicYear';

// ── Admin-facing batch list item — matches BatchesService.findAllBatches
export interface BatchListItem {
  id: string;
  name: string;
  classYear: string | null;
  section: string | null;
  academicYear: string | null;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  studentCount: number;
  teacherCount: number;
}

// ── Real per-student performance, from BatchesService.getBatchPerformance
export interface BatchPerformanceStudent {
  id: string;
  name: string;
  rollNumber: string | null;
  avgScore: number;
  lastTestScore: number | null;
  lastTestMax: number | null;
  status: 'unscored' | 'weak' | 'average' | 'excellent';
  rank: number;
}

export interface BatchPerformance {
  batch: { id: string; name: string; classYear: string | null; section: string | null; studentCount: number; avgScore: number; trend: 'up' | 'down' | 'stable' };
  students: BatchPerformanceStudent[];
}

// ── Full batch profile for the drawer — matches BatchesService.findBatchById
export interface BatchProfile extends BatchListItem {
  students: { id: string; name: string; email: string }[];
  teachers: { id: string; name: string; email: string; subjectId: string | null }[];
}

// ── Real roster aggregates — matches BatchesService.getStats
export interface BatchesStats {
  total: number;
  active: number;
  inactive: number;
  byClassYear: { classYear: string; count: number }[];
  byEnrollment: { batchId: string; batchName: string; studentCount: number }[];
}

// ── Service parameters (client-side filter/sort — the list endpoint has no
// server-side pagination; institute batch counts are small enough for this)
export interface GetBatchesParams {
  search?: string;
  classYear?: string;
  isActive?: boolean;
  sortBy?: BatchSortField;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface CreateBatchInput {
  name: string;
  classYear?: string;
  section?: string;
  academicYear?: string;
  branchId?: string;
}

export interface UpdateBatchInput extends Partial<CreateBatchInput> {
  id: string;
  isActive?: boolean;
}

export interface PaginatedBatches {
  data: BatchListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
