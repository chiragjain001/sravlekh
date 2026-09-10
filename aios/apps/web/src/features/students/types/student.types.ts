// ─── Students Feature: Types ──────────────────────────────────────────────────
// Real shapes only — mirrors apps/api/src/students/dto/student.dto.ts and the
// StudentProfile Prisma model. No field here exists without a backing endpoint.

export const STUDENT_TAG_VALUES = [
  'fast-learner',
  'concept-weak',
  'needs-revision',
  'high-risk',
  'inconsistent',
  'absentee-sensitive',
  'exam-anxiety',
  'ready-for-hard-paper',
] as const;
export type StudentTag = (typeof STUDENT_TAG_VALUES)[number];

export type StudentAccountStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
export type SortDirection = 'asc' | 'desc';
export type StudentSortField = 'name' | 'rollNumber' | 'admissionDate';

// ── Admin-facing student list record (flat, table-optimized) — matches the
// StudentsController.findAll → StudentProfile shape returned by the API.
export interface StudentListItem {
  id: string;
  userId: string;
  rollNumber: string | null;
  name: string;
  email: string;
  avatarInitials: string;

  batchId: string | null;
  batchLabel: string;

  tags: string[];
  status: StudentAccountStatus;

  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  address: string | null;
  dateOfBirth: string | null;

  admissionDate: string; // ISO
}

export interface StudentScoreRecord {
  id: string;
  score: number;
  maxScore: number;
  pct: number;
  exam: { id: string; title: string; scheduledDate: string | null; type: string } | null;
}

export interface StudentMasteryRow {
  id: string;
  topicName: string;
  subjectName: string;
  score: number; // 0-1
  lastUpdatedAt: string;
}

export interface StudentHistoryEntry {
  id: string;
  eventType: string;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedByUserId: string | null;
}

// ── Full student profile for the detail drawer — matches StudentsService.findById
export interface StudentProfile extends StudentListItem {
  scoreRecords: StudentScoreRecord[];
  masteryScores: StudentMasteryRow[];
  profileHistory: StudentHistoryEntry[];
}

// ── Real roster aggregates — matches StudentsService.getStats
export interface StudentsStats {
  total: number;
  active: number;
  inactive: number;
  newLast30Days: number;
  byBatch: { batchId: string | null; batchName: string; count: number }[];
  byTag: { tag: string; count: number }[];
  enrollmentByMonth: { month: string; count: number }[];
}

// ── Service layer param types
export interface GetStudentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  batchId?: string;
  tags?: string[];
  status?: StudentAccountStatus;
  sortBy?: StudentSortField;
  sortDir?: SortDirection;
}

export interface CreateStudentInput {
  name: string;
  email: string;
  rollNumber?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;
  batchId?: string;
  tags?: string[];
}

export interface UpdateStudentInput extends Partial<CreateStudentInput> {
  id: string;
}

export interface PaginatedStudents {
  data: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
