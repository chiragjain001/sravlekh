// ─── Academics Module: Mock Data Layer ─────────────────────────────────────────

import type { AcademicsAnalytics } from '../types/academic.types';

export const MOCK_ACADEMICS_DATA: AcademicsAnalytics = {
  overallCompletionPct:   68,
  upcomingExamsCount:     15,
  pendingPapersCount:     7,
  activeAssignmentsCount: 26,
  unresolvedDoubtsCount:  31,

  syllabusTrend: [
    { month: 'Dec', value: 25 },
    { month: 'Jan', value: 35 },
    { month: 'Feb', value: 45 },
    { month: 'Mar', value: 55 },
    { month: 'Apr', value: 65 },
    { month: 'May', value: 68 },
  ],

  subjectProgress: [
    { id: 'sub-1', teacherName: 'Rahul Verma',  subject: 'Physics',     progress: 72, color: 'bg-blue-600',     chaptersDone: 18, totalChapters: 25 },
    { id: 'sub-2', teacherName: 'Pooja Sharma', subject: 'Chemistry',   progress: 68, color: 'bg-emerald-500',  chaptersDone: 17, totalChapters: 25 },
    { id: 'sub-3', teacherName: 'Amit Singh',   subject: 'Mathematics', progress: 75, color: 'bg-indigo-600',   chaptersDone: 15, totalChapters: 20 },
    { id: 'sub-4', teacherName: 'Meera Joshi',  subject: 'Biology',     progress: 65, color: 'bg-purple-600',   chaptersDone: 13, totalChapters: 20 },
    { id: 'sub-5', teacherName: 'Sunil Kapoor', subject: 'English',     progress: 80, color: 'bg-amber-500',    chaptersDone: 16, totalChapters: 20 },
  ],

  pipelineStages: [
    { id: 'stg-1', label: 'Draft',      count: 12 },
    { id: 'stg-2', label: 'Approval',   count: 7 },
    { id: 'stg-3', label: 'Published',  count: 15 },
    { id: 'stg-4', label: 'Conducted',  count: 9 },
    { id: 'stg-5', label: 'Evaluation', count: 6 },
    { id: 'stg-6', label: 'Locked',     count: 4 },
  ],

  doubtQueue: [
    { id: 'd-1', teacherName: 'Rahul Verma',  subject: 'Physics',     unresolvedCount: 12, status: 'unresolved' },
    { id: 'd-2', teacherName: 'Pooja Sharma', subject: 'Chemistry',   unresolvedCount: 10, status: 'unresolved' },
    { id: 'd-3', teacherName: 'Amit Singh',   subject: 'Mathematics', unresolvedCount: 6,  status: 'unresolved' },
    { id: 'd-4', teacherName: 'Meera Joshi',  subject: 'Biology',     unresolvedCount: 3,  status: 'unresolved' },
  ],

  teacherTasks: [
    { id: 'tk-1', task: 'Grade JEE Main Mock 07 Physics Section', teacherName: 'Rahul Verma', subject: 'Physics', dueDate: '2025-05-25', priority: 'high' },
    { id: 'tk-2', task: 'Upload NEET Unit Test 05 Blueprint', teacherName: 'Pooja Sharma', subject: 'Chemistry', dueDate: '2025-05-26', priority: 'medium' },
    { id: 'tk-3', task: 'Review Foundation 11A Assignment Submissions', teacherName: 'Amit Singh', subject: 'Mathematics', dueDate: '2025-05-27', priority: 'low' },
  ],

  aiInsights: [
    {
      id: 'ai-1',
      title: 'Reinforcement Recommendation',
      category: 'reinforcement',
      description: '12 topics across Physics and Organic Chemistry show weak average scores (below 55%). Recommend scheduling 2 extra revision sessions.',
      recommendedAction: 'Schedule Revision Seminars for JEE 2025 Cohorts',
    },
    {
      id: 'ai-2',
      title: 'Syllabus Pacing Ahead of Target',
      category: 'pacing',
      description: 'English and Mathematics departments are 2 weeks ahead of curriculum milestones.',
      recommendedAction: 'Allocate mock test review slots',
    },
  ],
};
