// ─── Students Feature: Types ──────────────────────────────────────────────────
// These types drive the Students Module service layer.
// The Student domain types in /types/domain/student.types.ts remain the canonical
// entity shape. These are the "view-model" and "service-param" types consumed
// exclusively by the Students Module.

export type StudentRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type StudentFeeStatus = 'paid' | 'partial' | 'overdue' | 'waived';
export type StudentStatus    = 'active' | 'inactive' | 'suspended' | 'graduated';
export type SortDirection    = 'asc' | 'desc';

// ── Admin-facing student list record (flat, table-optimized)
export interface StudentListItem {
  id:           string;
  rollNo:       string;
  name:         string;
  email:        string;
  phone:        string;
  avatarInitials: string;

  // Academic placement
  program:      string;   // 'JEE' | 'NEET' | '11th' | '12th' | etc.
  batchId:      string;
  batchLabel:   string;
  classLabel:   string;

  // Performance (computed)
  avgScore:     number;         // 0–100
  attendancePct: number;        // 0–100
  weakTopicsCount: number;
  rank:         number | null;
  lastActiveAt: string;         // ISO

  // Status flags
  feeStatus:    StudentFeeStatus;
  riskLevel:    StudentRiskLevel;
  status:       StudentStatus;

  // Parent
  parentName:   string | null;
  parentPhone:  string | null;

  // Metadata
  enrolledAt:   string;         // ISO
}

// ── Full student profile for the detail drawer
export interface StudentProfile extends StudentListItem {
  // Performance history
  testHistory: StudentTestRecord[];
  subjectScores: StudentSubjectScore[];
  attendanceHistory: StudentAttendanceRecord[];

  // Academic intelligence
  weakTopics: StudentWeakTopic[];
  aiInsights: StudentAIInsight[];

  // Assignments summary
  assignmentStats: {
    total:     number;
    submitted: number;
    graded:    number;
    overdue:   number;
  };

  // Timeline
  timeline: StudentTimelineEvent[];
}

export interface StudentTestRecord {
  testId:    string;
  testName:  string;
  date:      string;
  score:     number;
  maxScore:  number;
  pct:       number;
  rank:      number | null;
  batchRank: number | null;
}

export interface StudentSubjectScore {
  subject: string;
  score:   number;
  color:   string;
}

export interface StudentAttendanceRecord {
  month:    string;
  present:  number;
  absent:   number;
  total:    number;
  pct:      number;
}

export interface StudentWeakTopic {
  topic:    string;
  subject:  string;
  mastery:  number;   // 0–100 (lower = weaker)
  trend:    'up' | 'down' | 'flat';
}

export interface StudentAIInsight {
  type:    'warning' | 'info' | 'success';
  message: string;
  action:  string | null;
}

export interface StudentTimelineEvent {
  id:        string;
  type:      'enrolled' | 'test' | 'fee' | 'attendance' | 'intervention' | 'note';
  title:     string;
  detail:    string | null;
  date:      string;
  actor:     string;
}

// ── Analytics aggregates (for the Analytics tab)
export interface StudentsAnalytics {
  totalStudents:   number;
  activeStudents:  number;
  atRiskCount:     number;
  newAdmissions:   number;

  enrollmentTrend: EnrollmentPoint[];
  feeBreakdown:    FeeBreakdownItem[];
  subjectGapMap:   SubjectGapItem[];
  riskDistribution: RiskDistItem[];
  batchPerformance: BatchPerfItem[];
}

export interface EnrollmentPoint { month: string; count: number; }
export interface FeeBreakdownItem { label: string; value: number; color: string; }
export interface SubjectGapItem   { subject: string; gap: number; color: string; }
export interface RiskDistItem     { level: string; count: number; color: string; }
export interface BatchPerfItem    { batch: string; avg: number; attendance: number; }

// ── Service layer param types
export interface GetStudentsParams {
  page?:      number;
  pageSize?:  number;
  search?:    string;
  program?:   string;
  batch?:     string;
  status?:    StudentStatus;
  feeStatus?: StudentFeeStatus;
  riskLevel?: StudentRiskLevel;
  sortBy?:    keyof StudentListItem;
  sortDir?:   SortDirection;
}

export interface CreateStudentInput {
  name:         string;
  email:        string;
  phone:        string;
  rollNo?:      string;
  program:      string;
  batchId:      string;
  classId:      string;
  enrolledExams: string[];
  parentName?:  string;
  parentPhone?: string;
}

export interface UpdateStudentInput extends Partial<CreateStudentInput> {
  id:     string;
  status?: StudentStatus;
}

export interface PaginatedStudents {
  data:       StudentListItem[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}
