// ─── Teachers Feature: Types ──────────────────────────────────────────────────
// Real shapes only — mirrors apps/api/src/teachers/dto/teacher.dto.ts and the
// TeacherProfile Prisma model. No appraisal/rating/leave fields — no such
// domain exists in the backend.

export type TeacherAccountStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
export type SortDirection = 'asc' | 'desc';
export type TeacherSortField = 'name' | 'qualification';

export interface TeacherBatchAssignment {
  id: string; // BatchTeacher id — needed to remove the assignment
  batchId: string;
  batchName: string;
  subjectId: string | null;
}

// ── Admin-facing teacher list record (flat, table-optimized) — matches the
// TeachersController.findAll → TeacherProfile shape returned by the API.
export interface TeacherListItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarInitials: string;
  qualification: string | null;
  subjectIds: string[];
  status: TeacherAccountStatus;
  batchAssignments: TeacherBatchAssignment[];
  joinedOn: string; // ISO — from user.createdAt if available, else profile.createdAt
}

// ── Full teacher profile for the detail drawer
export interface TeacherProfile extends TeacherListItem {
  availability: Record<string, unknown> | null;
}

// ── Real roster aggregates — matches TeachersService.getStats
export interface TeachersStats {
  total: number;
  active: number;
  inactive: number;
  unassignedToSubject: number;
  withBatchAssignment: number;
  withoutBatchAssignment: number;
  bySubject: { subject: string; count: number }[];
}

// ── Service layer param types
export interface GetTeachersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  subjectId?: string;
  status?: TeacherAccountStatus;
  sortBy?: TeacherSortField;
  sortDir?: SortDirection;
}

export interface CreateTeacherInput {
  name: string;
  email: string;
  qualification?: string;
  subjectIds?: string[];
}

export interface UpdateTeacherInput extends Partial<CreateTeacherInput> {
  id: string;
}

export interface PaginatedTeachers {
  data: TeacherListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
