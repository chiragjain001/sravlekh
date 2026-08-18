// ─── Domain: Test / Exam Types ────────────────────────────────────────────────
import type { EntityLifecycleStatus, EntityOwnership, QuestionType } from '../academic-context.types';

export type TestMode = 'online' | 'offline' | 'hybrid';

export type EvaluationStatus = 'pending' | 'graded' | 'disputed' | 'finalized';

export interface Test {
  id:             string;
  name:           string;
  type:           TestType;
  mode:           TestMode;
  status:         EntityLifecycleStatus;

  // ── Academic Context
  instituteId:    string;
  branchId:       string;
  sessionId:      string;
  examId:         string | null;
  classId:        string;
  batchIds:       string[];       // Test can span multiple batches
  subjectId:      string;
  teacherId:      string;
  paperId:        string | null;  // linked paper from Paper Builder

  // ── Configuration
  totalMarks:     number;
  totalQuestions: number;
  duration:       number;         // minutes
  negativeMarking: string;        // e.g., "-1 for each wrong"
  instructions:   string;
  shuffleQuestions: boolean;
  shuffleOptions:   boolean;
  showSolutions:    boolean;

  // ── Scheduling
  scheduledDate:  string | null;
  startTime:      string | null;
  endTime:        string | null;
  publishedAt:    string | null;

  // ── Per-batch personalized test support
  isPersonalized: boolean;

  // ── Stats (computed per batch)
  batchStats:     Record<string, TestBatchStats>;

  // ── Ownership
  ownership:      EntityOwnership;
  createdAt:      string;
  updatedAt:      string;
}

export type TestType =
  | 'unit-test'
  | 'chapter-test'
  | 'weekly-test'
  | 'mock-test'
  | 'dpp'
  | 'full-syllabus'
  | 'practice';

export interface TestBatchStats {
  batchId:        string;
  totalStudents:  number;
  attempted:      number;
  graded:         number;
  avgScore:       number;
  topScore:       number;
  passCount:      number;
  failCount:      number;
}

// ── Per-student personalized test (when isPersonalized = true)
export interface PersonalizedTest {
  id:             string;
  testId:         string;
  studentId:      string;
  batchId:        string;

  questionIds:    string[];       // AI-selected for this student
  totalQuestions: number;
  reasoning:      string;         // AI explanation

  status:         'generated' | 'started' | 'submitted' | 'graded';
  startedAt:      string | null;
  submittedAt:    string | null;
  score:          number | null;
  maxScore:       number;
  timeTaken:      number | null;  // seconds
}

export interface Evaluation {
  id:             string;
  testId:         string;
  studentId:      string;
  batchId:        string;
  name:           string;
  rollNo:         string;
  marksObtained:  number;
  totalMarks:     number;
  percentage:     number;
  rank:           number | null;
  status:         EvaluationStatus;
  answers:        EvaluationAnswer[];
  feedback:       string | null;
  gradedBy:       string | null;
  gradedAt:       string | null;
}

export interface EvaluationAnswer {
  questionId:   string;
  questionNum:  number;
  topic:        string;
  subtopic:     string;
  givenAnswer:  string | null;
  correctAnswer: string;
  isCorrect:    boolean;
  marksAwarded: number;
  timeSpent:    number;           // seconds
  difficulty:   string;
}

export interface TestQuestionAnalysis {
  questionId:   string;
  questionNum:  string;
  topic:        string;
  subtopic:     string;
  correctPct:   number;
  difficulty:   string;
  avgTimeSec:   number;
  discriminationIndex: number;   // How well it differentiates strong vs weak students
}

export interface CreateTestInput {
  name:           string;
  type:           TestType;
  mode:           TestMode;
  batchIds:       string[];
  subjectId:      string;
  paperId?:       string;
  totalMarks:     number;
  totalQuestions: number;
  duration:       number;
  negativeMarking: string;
  instructions:   string;
  shuffleQuestions: boolean;
  shuffleOptions:   boolean;
  showSolutions:    boolean;
  scheduledDate?:  string;
  startTime?:      string;
  endTime?:        string;
  isPersonalized?: boolean;
}
