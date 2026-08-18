// ─── Exams Feature: Types ──────────────────────────────────────────────────────

export type ExamType      = 'Mock Test' | 'Part Test' | 'Subjective' | 'Weekly Test' | 'DPP Test';
export type ExamStatus    = 'Upcoming' | 'In-Progress' | 'Evaluation Pending' | 'Completed' | 'Cancelled';
export type SortDirection = 'asc' | 'desc';

// ── Admin-facing exam list record
export interface ExamListItem {
  id:         string;
  code:       string;             // e.g. 'JEE-M08'
  name:       string;             // e.g. 'JEE Main Mock Test 08'
  batch:      string;             // e.g. 'JEE 2025 Star'
  type:       ExamType;
  date:       string;             // e.g. '26 May 2025' or ISO
  duration:   string;             // e.g. '3 Hrs'
  students:   number;             // registered candidate count
  status:     ExamStatus;
  maxMarks:   number;             // e.g. 300
  avgScore:   number;             // e.g. 78%
  passRate:   number;             // e.g. 84%
}

// ── Full exam profile for detail drawer
export interface ExamProfile extends ExamListItem {
  program:              string;
  subject:              string;
  authorFaculty:        string;
  instructions:         string;
  registeredCandidates: CandidateRegistration[];
  questionPaperBlueprint: QuestionBlueprintItem[];
  timeline:             ExamTimelineEvent[];
}

export interface CandidateRegistration {
  id:           string;
  rollNo:       string;
  name:         string;
  batchName:    string;
  scorePct?:    number;
  status:       'registered' | 'appeared' | 'absent';
}

export interface QuestionBlueprintItem {
  qNo:        number;
  section:    string;
  type:       'MCQ' | 'Numerical' | 'Subjective';
  marks:      number;
  topic:      string;
}

export interface ExamTimelineEvent {
  id:     string;
  type:   'scheduled' | 'blueprint_approved' | 'test_conducted' | 'results_published';
  title:  string;
  detail: string | null;
  date:   string;
  actor:  string;
}

// ── Analytics Aggregates
export interface ExamsAnalytics {
  totalExams:        number;
  upcomingExams:     number;
  completedExams:    number;
  evaluationPending: number;
  avgPassPercentage: number;

  passPercentageTrend: { month: string; passRate: number }[];
  topPerformers:       { rank: number; name: string; score: string; avatar: string }[];
  examOverview:        { name: string; value: number; color: string; percent: string }[];
  evaluationStatus:    { name: string; value: number; color: string }[];
  operationalAlerts:   { id: string; message: string; severity: 'low' | 'medium' | 'high' }[];
}

// ── Service params
export interface GetExamsParams {
  page?:     number;
  pageSize?: number;
  search?:   string;
  type?:     ExamType;
  status?:   ExamStatus;
  batch?:    string;
  sortBy?:   keyof ExamListItem;
  sortDir?:  SortDirection;
}

export interface CreateExamInput {
  name:      string;
  code?:     string;
  batch:     string;
  type:      ExamType;
  date:      string;
  duration:  string;
  students?: number;
  maxMarks?: number;
}

export interface UpdateExamInput extends Partial<CreateExamInput> {
  id:      string;
  status?: ExamStatus;
}

export interface PaginatedExams {
  data:       ExamListItem[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}
