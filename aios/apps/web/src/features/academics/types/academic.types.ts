// ─── Academics Feature: Types ──────────────────────────────────────────────────

export interface SubjectSyllabusProgress {
  id:            string;
  teacherName:   string;          // e.g. 'Rahul Verma', 'Pooja Sharma'
  subject:       string;          // e.g. 'Physics', 'Chemistry'
  progress:      number;          // 0-100%
  color:         string;          // Tailwind / hex color
  chaptersDone:  number;
  totalChapters: number;
}

export interface SyllabusTrendPoint {
  month: string;                  // e.g. 'Dec', 'Jan'
  value: number;                  // percentage
}

export interface ExamPipelineStage {
  id:    string;
  label: string;                  // 'Draft', 'Approval', 'Published', 'Conducted', 'Evaluation', 'Locked'
  count: number;
}

export interface ExamPipelineItem {
  id:           string;
  title:        string;
  subject:      string;
  stage:        string;
  author:       string;
  targetDate:   string;
}

export interface AcademicDoubtQueueItem {
  id:              string;
  teacherName:     string;
  subject:         string;
  unresolvedCount: number;
  status:          'unresolved' | 'assigned' | 'resolved';
}

export interface TeacherPendingTask {
  id:         string;
  task:       string;
  teacherName: string;
  subject:    string;
  dueDate:    string;
  priority:   'low' | 'medium' | 'high';
}

export interface AiAcademicInsight {
  id:          string;
  title:       string;
  category:    'reinforcement' | 'pacing' | 'risk_alert';
  description: string;
  recommendedAction: string;
}

export interface AcademicsAnalytics {
  overallCompletionPct: number;
  upcomingExamsCount:   number;
  pendingPapersCount:   number;
  activeAssignmentsCount: number;
  unresolvedDoubtsCount: number;

  syllabusTrend:      SyllabusTrendPoint[];
  subjectProgress:    SubjectSyllabusProgress[];
  pipelineStages:     ExamPipelineStage[];
  doubtQueue:         AcademicDoubtQueueItem[];
  teacherTasks:       TeacherPendingTask[];
  aiInsights:         AiAcademicInsight[];
}

export interface GetAcademicsParams {
  search?:  string;
  subject?: string;
  year?:    string;
}
