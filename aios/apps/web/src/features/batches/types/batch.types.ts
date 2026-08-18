// ─── Batches Feature: Types ────────────────────────────────────────────────────

export type BatchProgram    = 'JEE' | 'NEET' | 'Class 11' | 'Class 12' | 'Foundation';
export type BatchStatus     = 'active' | 'upcoming' | 'completed' | 'archived';
export type SortDirection   = 'asc' | 'desc';

// ── Admin-facing batch list item
export interface BatchListItem {
  id:              string;
  code:            string;          // e.g. 'B-JEE-2025-01'
  name:            string;          // e.g. 'JEE 2025 Star Batch'
  program:         BatchProgram;
  targetYear:      string;          // e.g. '2025' or '2024-25'
  branchName:      string;

  // Capacity & Students
  enrolledStudents: number;
  maxCapacity:      number;

  // Mentor & Faculty
  leadMentor:      string;          // e.g. 'Rahul Verma'
  mentorAvatar:    string;
  facultyCount:    number;

  // Performance & Progress
  attendancePct:   number;          // e.g. 92%
  avgScore:        number;          // e.g. 84%
  syllabusProgress: number;         // e.g. 72%

  // Assessment & Status
  nextTestName:    string;
  nextTestDate:    string;          // e.g. '2025-05-24'
  status:          BatchStatus;
  startDate:       string;
  endDate:         string;
}

// ── Full batch profile for drawer
export interface BatchProfile extends BatchListItem {
  roomNo:             string;
  scheduleSummary:    string;        // e.g. 'Mon, Wed, Fri (09:00 - 12:30)'
  description:        string;

  enrolledStudentsList: BatchStudentSummary[];
  assignedFaculty:      BatchFacultySummary[];
  upcomingTests:        BatchTestSummary[];
  syllabusChapters:     SyllabusChapterProgress[];
  timeline:             BatchTimelineEvent[];
}

export interface BatchStudentSummary {
  id:            string;
  rollNo:        string;
  name:          string;
  avgScore:      number;
  attendancePct: number;
  riskLevel:     'low' | 'medium' | 'high';
}

export interface BatchFacultySummary {
  id:          string;
  name:        string;
  subject:     string;
  weeklyHours: number;
}

export interface BatchTestSummary {
  id:          string;
  title:       string;
  date:        string;
  maxMarks:    number;
  status:      'scheduled' | 'grading_in_progress' | 'completed';
}

export interface SyllabusChapterProgress {
  subject:       string;
  chapterName:   string;
  completedPct:  number;
  status:        'completed' | 'in_progress' | 'pending';
}

export interface BatchTimelineEvent {
  id:     string;
  type:   'created' | 'mentor_assigned' | 'test_conducted' | 'milestone';
  title:  string;
  detail: string | null;
  date:   string;
  actor:  string;
}

// ── Analytics Aggregates
export interface BatchesAnalytics {
  totalBatches:     number;
  activeCohorts:    number;
  avgCapacityPct:   number;
  upcomingBatches:  number;

  capacityUtilization: { name: string; value: number; color: string }[];
  cohortComparison:    { name: string; avgScore: number; attendance: number }[];
  topBatches:          { name: string; mentor: string; score: number }[];
  attentionRequired:   { name: string; mentor: string; score: number; reason: string }[];
}

// ── Service parameters
export interface GetBatchesParams {
  page?:       number;
  pageSize?:   number;
  search?:     string;
  program?:    BatchProgram;
  targetYear?: string;
  status?:     BatchStatus;
  sortBy?:     keyof BatchListItem;
  sortDir?:    SortDirection;
}

export interface CreateBatchInput {
  name:            string;
  code?:           string;
  program:         BatchProgram;
  targetYear:      string;
  maxCapacity:     number;
  leadMentor:      string;
  roomNo?:         string;
  startDate?:      string;
  endDate?:        string;
}

export interface UpdateBatchInput extends Partial<CreateBatchInput> {
  id:      string;
  status?: BatchStatus;
}

export interface PaginatedBatches {
  data:       BatchListItem[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}
