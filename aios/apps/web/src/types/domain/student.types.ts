// ─── Domain: Student Types ────────────────────────────────────────────────────
import type { EntityLifecycleStatus, EntityOwnership } from '../academic-context.types';

export type StudentStatus = 'excellent' | 'good' | 'average' | 'weak' | 'critical';

export interface Student {
  id:           string;
  userId:       string;
  rollNo:       string;
  name:         string;
  email:        string;
  phone:        string | null;
  avatarUrl:    string | null;
  avatarInitials: string;

  // ── Academic Context
  instituteId:  string;
  branchId:     string;
  sessionId:    string;
  classId:      string;
  batchId:      string;
  enrolledExams: string[];         // examIds student is preparing for

  // ── Performance (computed)
  avgScore:     number;
  lastTestScore: number | null;
  lastTestMax:  number | null;
  rank:         number | null;
  status:       StudentStatus;
  attendancePct: number;

  // ── Parent info
  parentId:     string | null;
  parentName:   string | null;
  parentPhone:  string | null;

  // ── Enrollment
  enrolledAt:   string;
  ownership:    EntityOwnership;
}

// ── Per-student academic intelligence (the core of AIOS personalization)
export interface StudentIntelligence {
  studentId:      string;
  batchId:        string;
  sessionId:      string;
  subjectId:      string;
  computedAt:     string;         // ISO string when last computed

  // ── Mastery Map (per topic)
  topicMastery:   StudentTopicMastery[];

  // ── Behavioral patterns
  attemptRate:    number;          // % of assignments/tests attempted
  consistencyScore: number;        // Score consistency across tests
  improvementRate: number;         // Trend over last N tests

  // ── AI Recommendations
  weakTopics:     string[];
  recommendedActions: AIRecommendation[];
  riskLevel:      'low' | 'medium' | 'high' | 'critical';
  riskReason:     string | null;

  // ── Personalization Profile
  learningStyle:  LearningStyle | null;
  optimalDifficulty: 'easy' | 'medium' | 'hard';
  optimalQuestionCount: number;
}

export interface StudentTopicMastery {
  topicId:      string;
  topic:        string;
  chapter:      string;
  mastery:      number;           // 0–100
  attempts:     number;
  trend:        'up' | 'down' | 'flat';
  lastAttempt:  string | null;
}

export interface AIRecommendation {
  type:         'assignment' | 'extra-class' | 'schedule-test' | 'revision';
  label:        string;
  topicHint:    string | null;
  urgency:      'low' | 'medium' | 'high';
  reason:       string;
}

export type LearningStyle = 'visual' | 'numerical' | 'conceptual' | 'mixed';

export interface StudentTestHistory {
  testId:       string;
  testName:     string;
  date:         string;
  score:        number;
  maxScore:     number;
  percentage:   number;
  rank:         number | null;
  rankInBatch:  number | null;
  improvement:  number | null;    // compared to previous test
}

export interface StudentProfile extends Student {
  testHistory:     StudentTestHistory[];
  intelligence:    StudentIntelligence | null;
  assignments:     StudentAssignmentSummary[];
  doubts:          StudentDoubtSummary[];
}

export interface StudentAssignmentSummary {
  assignmentId: string;
  title:        string;
  dueDate:      string;
  status:       'pending' | 'submitted' | 'graded' | 'overdue';
  score:        number | null;
  maxScore:     number | null;
  isPersonalized: boolean;
}

export interface StudentDoubtSummary {
  doubtId:    string;
  topic:      string;
  askedAt:    string;
  status:     'pending' | 'resolved';
}

export interface EnrollStudentInput {
  name:        string;
  email:       string;
  phone:       string;
  classId:     string;
  batchId:     string;
  enrolledExams: string[];
  parentName?: string;
  parentPhone?: string;
  rollNo?:     string;
}
