// ─── Domain: Doubt Types ──────────────────────────────────────────────────────
import type { EntityLifecycleStatus, EntityOwnership } from '../academic-context.types';

export type DoubtStatus = 'pending' | 'assigned' | 'resolved' | 'closed';
export type DoubtPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Doubt {
  id:           string;
  question:     string;
  imageUrls:    string[];          // Student can attach images

  // ── Academic Context
  instituteId:  string;
  branchId:     string;
  sessionId:    string;
  batchId:      string;
  subjectId:    string;
  topic:        string;
  chapter:      string | null;

  // ── Parties
  studentId:    string;
  studentName:  string;
  assignedTeacherId: string | null;

  // ── Status
  status:       DoubtStatus;
  priority:     DoubtPriority;
  askedAt:      string;           // ISO string
  assignedAt:   string | null;
  resolvedAt:   string | null;
  daysOpen:     number;           // computed

  // ── Resolution
  resolution:   DoubtResolution | null;

  // ── AI Solution (auto-generated, teacher can accept/modify)
  aiSolution:   AIDoubtSolution | null;

  ownership:    EntityOwnership;
}

export interface DoubtResolution {
  answer:         string;
  imageUrls:      string[];
  resolvedBy:     string;         // teacherId
  resolvedByName: string;
  method:         'text' | 'video' | 'ai-assisted';
  studentRating:  number | null;  // 1–5 star rating from student
}

export interface AIDoubtSolution {
  answer:        string;
  steps:         string[];
  relatedTopics: string[];
  confidence:    number;          // 0–1
  generatedAt:   string;
}

export interface SubmitDoubtInput {
  question:   string;
  subjectId:  string;
  topic:      string;
  chapter?:   string;
  imageUrls?: string[];
}

export interface ResolveDoubtInput {
  answer:     string;
  imageUrls?: string[];
  method:     'text' | 'video' | 'ai-assisted';
}

// ─── Domain: Teacher Types ────────────────────────────────────────────────────
import type { UserRole } from '../db.types';

export interface Teacher {
  id:           string;
  userId:       string;
  name:         string;
  email:        string;
  phone:        string | null;
  avatarUrl:    string | null;
  avatarInitials: string;
  designation:  string;

  // ── Institute
  instituteId:  string;
  branchId:     string;

  // ── Assignments (what classes/subjects/batches this teacher covers)
  batchAssignments: TeacherBatchAssignment[];
  subjects:         string[];         // subjectIds

  // ── Stats
  activeBatches:    number;
  totalStudents:    number;
  pendingGrading:   number;
  pendingDoubts:    number;

  joinedOn:     string;
  status:       'active' | 'inactive' | 'on-leave';
  ownership:    EntityOwnership;
}

export interface TeacherBatchAssignment {
  batchId:      string;
  batchLabel:   string;
  classId:      string;
  subjectId:    string;
  subject:      string;
  isPrimary:    boolean;
}

// ─── Domain: Notification Types ───────────────────────────────────────────────
export type NotificationType =
  | 'assignment_created'
  | 'assignment_submitted'
  | 'assignment_graded'
  | 'test_scheduled'
  | 'test_graded'
  | 'doubt_submitted'
  | 'doubt_resolved'
  | 'doubt_assigned'
  | 'extra_class_scheduled'
  | 'announcement'
  | 'reminder'
  | 'alert';

export interface Notification {
  id:           string;
  type:         NotificationType;
  title:        string;
  message:      string;
  isRead:       boolean;
  createdAt:    string;

  // ── Context (for deep linking on click)
  targetRole:   UserRole | 'ALL';
  targetUserId: string | null;
  targetBatchId: string | null;
  deepLink:     string | null;    // URL to navigate to on click

  // ── Sender
  sentBy:       string;           // userId or 'SYSTEM'
  sentByName:   string;
}

// ─── Domain: API Response Types ───────────────────────────────────────────────
export interface ApiResponse<T> {
  data:       T;
  message:    string | null;
  success:    boolean;
}

export interface PaginatedResponse<T> {
  data:       T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasMore:    boolean;
}

export interface ApiError {
  code:       string;
  message:    string;
  field?:     string;
  details?:   Record<string, string[]>;
}
