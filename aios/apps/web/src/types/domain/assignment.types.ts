// ─── Domain: Assignment Types ─────────────────────────────────────────────────
import type { EntityLifecycleStatus, EntityOwnership, AcademicContext } from '../academic-context.types';

export type AssignmentType = 'general' | 'personalized';

export type PublishMode = 'live' | 'online' | 'offline';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'mixed';

export interface Assignment {
  id:             string;
  title:          string;
  type:           AssignmentType;
  publishMode:    PublishMode;
  status:         EntityLifecycleStatus;

  // ── Academic Context
  instituteId:    string;
  branchId:       string;
  sessionId:      string;
  examId:         string | null;
  classId:        string;
  batchId:        string;
  subjectId:      string;
  teacherId:      string;

  // ── Content
  sources:        string[];
  chapters:       string[];
  topics:         string[];
  subtopics:      string[];
  totalQuestions: number;
  difficulty:     DifficultyLevel;
  difficultyDistribution: DifficultyDistribution;
  estimatedTime:  number;         // minutes
  marksPerQuestion: number;
  totalMarks:     number;
  randomizeQuestions: boolean;
  showSolutionsAfterSubmission: boolean;
  instructions:   string;

  // ── Personalization (populated when type = 'personalized')
  personalizationFactors: PersonalizationFactors | null;

  // ── Scheduling
  dueDate:        string;         // ISO string
  dueTime:        string;         // HH:MM
  publishedAt:    string | null;

  // ── Stats (computed)
  totalStudents:  number;
  submittedCount: number;
  gradedCount:    number;
  avgScore:       number | null;

  // ── Ownership & Audit
  ownership:      EntityOwnership;
  createdAt:      string;
  updatedAt:      string;
}

export interface DifficultyDistribution {
  easy:   number;  // percentage
  medium: number;
  hard:   number;
}

export interface PersonalizationFactors {
  weakTopics:             boolean;
  previousPerformance:    boolean;
  accuracyTrend:          boolean;
  learningProgress:       boolean;
  difficultyAdaptation:   boolean;
  practiceHistory:        boolean;
}

// ── Per-student personalized assignment (child of Assignment when type='personalized')
export interface PersonalizedAssignment {
  id:           string;
  assignmentId: string;
  studentId:    string;
  batchId:      string;

  // AI-generated for this specific student
  questionIds:  string[];
  totalQuestions: number;
  difficulty:   DifficultyLevel;
  focusTopics:  string[];         // Topics AI determined this student needs
  reasoning:    string;           // AI explanation of why these questions

  status:       'generated' | 'submitted' | 'graded';
  submittedAt:  string | null;
  score:        number | null;
  maxScore:     number;
}

export interface AssignmentSubmission {
  id:           string;
  assignmentId: string;
  studentId:    string;
  batchId:      string;
  answers:      SubmissionAnswer[];
  submittedAt:  string;
  score:        number | null;
  maxScore:     number;
  gradedAt:     string | null;
  gradedBy:     string | null;
  feedback:     string | null;
  attachments:  string[];          // file URLs
}

export interface SubmissionAnswer {
  questionId: string;
  answer:     string | string[];
  isCorrect:  boolean | null;
  marksAwarded: number | null;
}

// ── Form input types (validated by Zod schema)
export interface CreateAssignmentInput {
  title:               string;
  type:                AssignmentType;
  publishMode:         PublishMode;
  batchId:             string;
  subjectId:           string;
  sources:             string[];
  chapters:            string[];
  topics:              string[];
  subtopics:           string[];
  totalQuestions:      number;
  difficulty:          DifficultyLevel;
  difficultyDistribution: DifficultyDistribution;
  estimatedTime:       number;
  marksPerQuestion:    number;
  randomizeQuestions:  boolean;
  showSolutionsAfterSubmission: boolean;
  instructions:        string;
  dueDate:             string;
  dueTime:             string;
  personalizationFactors?: PersonalizationFactors;
}

export type UpdateAssignmentInput = Partial<CreateAssignmentInput>;
