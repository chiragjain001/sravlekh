// ─── Teachers Feature: Types ──────────────────────────────────────────────────
// These types drive the Teachers Module service layer.

export type TeacherAvailability = 'available' | 'busy' | 'on_leave';
export type TeacherRole         = 'teacher' | 'head_of_dept' | 'adjunct_faculty';
export type SortDirection       = 'asc' | 'desc';

// ── Admin-facing teacher list record (flat, table-optimized)
export interface TeacherListItem {
  id:              string;
  empId:           string;
  name:            string;
  email:           string;
  phone:           string;
  avatarInitials:  string;
  designation:     string;
  role:            TeacherRole;

  // Academic scope
  subject:         string;          // e.g. 'Physics', 'Chemistry'
  subjects:        string[];        // multi-subject support
  assignedBatches: number;          // count
  batchLabels:     string[];        // e.g. ['JEE 2025 Star', 'NEET Target']
  weeklyClasses:   number;          // hours/week

  // Operational metrics
  pendingEvaluations: number;      // pending test grading count
  avgStudentScore:    number;      // 0–100%
  workloadPct:        number;      // 0–100% capacity utilization
  availability:       TeacherAvailability;
  rating:             number;      // 1.0 - 5.0 appraisal score

  // Metadata
  joinedOn:        string;          // ISO
  status:          'active' | 'inactive' | 'on_leave';
}

// ── Full teacher profile for detail drawer
export interface TeacherProfile extends TeacherListItem {
  qualification:      string;
  experienceYears:    number;
  bio:                string;

  // Schedule & Batches
  schedule:           TeacherScheduleSlot[];
  batchDetails:       TeacherBatchDetail[];

  // Appraisals & Evaluations
  appraisals:         TeacherAppraisalRecord[];
  pendingPapers:      PendingPaperApproval[];

  // Replacement & leave logs
  leaveRequests:      TeacherLeaveRequest[];
  timeline:           TeacherTimelineEvent[];
}

export interface TeacherScheduleSlot {
  id:        string;
  day:       'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
  timeSlot:  string;
  batchName: string;
  roomNo:    string;
  subject:   string;
}

export interface TeacherBatchDetail {
  batchId:        string;
  batchName:      string;
  studentCount:   number;
  avgBatchScore:  number;
  attendanceRate: number;
}

export interface TeacherAppraisalRecord {
  id:           string;
  period:       string;        // e.g. 'Q1 2025'
  rating:       number;        // out of 5
  feedback:     string;        // HOD comments
  evaluatedBy:  string;
  date:         string;
}

export interface PendingPaperApproval {
  id:          string;
  paperTitle:  string;
  batchName:   string;
  totalQuestions: number;
  submittedAt: string;
  status:      'pending' | 'approved' | 'rejected';
}

export interface TeacherLeaveRequest {
  id:         string;
  reason:     string;
  fromDate:   string;
  toDate:     string;
  status:     'pending' | 'approved' | 'rejected';
  substitute: string | null;
}

export interface TeacherTimelineEvent {
  id:     string;
  type:   'joined' | 'batch_assigned' | 'paper_submitted' | 'appraisal' | 'leave';
  title:  string;
  detail: string | null;
  date:   string;
  actor:  string;
}

// ── Analytics aggregates (for the Analytics tab)
export interface TeachersAnalytics {
  totalTeachers:       number;
  activeToday:         number;
  avgWorkloadHours:    number;
  pendingAppraisals:   number;

  subjectCoverage:     SubjectCoverageItem[];
  workloadDistribution: WorkloadDistItem[];
  topPerformers:       FacultyRankingItem[];
  departmentBreakdown: DepartmentBreakdownItem[];
}

export interface SubjectCoverageItem     { subject: string; teacherCount: number; color: string; }
export interface WorkloadDistItem        { range: string; count: number; color: string; }
export interface FacultyRankingItem      { rank: number; name: string; subject: string; score: string; avatar: string; }
export interface DepartmentBreakdownItem { dept: string; totalHours: number; avgRating: number; }

// ── Service params
export interface GetTeachersParams {
  page?:         number;
  pageSize?:     number;
  search?:       string;
  subject?:      string;
  availability?: TeacherAvailability;
  status?:       'active' | 'inactive' | 'on_leave';
  sortBy?:       keyof TeacherListItem;
  sortDir?:      SortDirection;
}

export interface CreateTeacherInput {
  name:            string;
  email:           string;
  phone:           string;
  empId?:          string;
  subject:         string;
  subjects?:       string[];
  designation?:    string;
  role?:           TeacherRole;
  qualification?:  string;
  experienceYears?: number;
}

export interface UpdateTeacherInput extends Partial<CreateTeacherInput> {
  id:            string;
  availability?: TeacherAvailability;
  status?:       'active' | 'inactive' | 'on_leave';
}

export interface PaginatedTeachers {
  data:       TeacherListItem[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}
