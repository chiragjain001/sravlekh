// ─── Exams Module: Mock Data Layer ──────────────────────────────────────────────

import type { ExamListItem, ExamProfile, ExamsAnalytics } from '../types/exam.types';

export const MOCK_EXAMS: ExamListItem[] = [
  { id: 'ex-001', code: 'JEE-M08',   name: 'JEE Main Mock Test 08',        batch: 'JEE 2025 Star',      type: 'Mock Test',  date: '26 May 2025', duration: '3 Hrs',   students: 126, status: 'Upcoming',           maxMarks: 300, avgScore: 78, passRate: 84 },
  { id: 'ex-002', code: 'NEET-PT05', name: 'NEET Part Test 05',            batch: 'NEET 2025 Target',   type: 'Part Test',  date: '28 May 2025', duration: '3 Hrs',   students: 98,  status: 'Upcoming',           maxMarks: 720, avgScore: 82, passRate: 88 },
  { id: 'ex-003', code: 'PHY-11T02', name: 'Class 11 Physics Test',        batch: 'Foundation 11A',     type: 'Subjective', date: '30 May 2025', duration: '2 Hrs',   students: 54,  status: 'Upcoming',           maxMarks: 100, avgScore: 70, passRate: 75 },
  { id: 'ex-004', code: 'CHEM-W06',  name: 'Chemistry Weekly Test',        batch: 'JEE 2026 Early',     type: 'Weekly Test',date: '31 May 2025', duration: '1.5 Hrs', students: 112, status: 'Upcoming',           maxMarks: 150, avgScore: 74, passRate: 80 },
  { id: 'ex-005', code: 'MATH-D12',  name: 'Maths DPP Test 12',            batch: 'Foundation 11B',     type: 'DPP Test',   date: '01 Jun 2025', duration: '1 Hr',     students: 61,  status: 'Upcoming',           maxMarks: 60,  avgScore: 68, passRate: 72 },
  { id: 'ex-006', code: 'JEE-FLT01', name: 'JEE Droppers Full Length 01',  batch: 'JEE Droppers 2026',  type: 'Mock Test',  date: '02 Jun 2025', duration: '3 Hrs',   students: 140, status: 'Upcoming',           maxMarks: 300, avgScore: 71, passRate: 76 },
  { id: 'ex-007', code: 'JEE-M07',   name: 'JEE Main Mock Test 07',        batch: 'JEE 2025 Star',      type: 'Mock Test',  date: '10 May 2025', duration: '3 Hrs',   students: 126, status: 'Evaluation Pending', maxMarks: 300, avgScore: 81, passRate: 86 },
  { id: 'ex-008', code: 'NEET-PT04', name: 'NEET Part Test 04',            batch: 'NEET 2025 Target',   type: 'Part Test',  date: '05 May 2025', duration: '3 Hrs',   students: 95,  status: 'Completed',          maxMarks: 720, avgScore: 84, passRate: 90 },
];

export function buildExamProfile(base: ExamListItem): ExamProfile {
  return {
    ...base,
    program:       base.batch.includes('NEET') ? 'NEET' : 'JEE',
    subject:       'Full Syllabus',
    authorFaculty: 'Rahul Verma & Senior Panel',
    instructions:  'Standard OMR based or Computer-Based Test (CBT). Negative marking applies (-1 for incorrect MCQs).',

    registeredCandidates: [
      { id: 'c-1', rollNo: 'AOS1001', name: 'Arjun Mehta',   batchName: base.batch, scorePct: 92, status: 'appeared' },
      { id: 'c-2', rollNo: 'AOS1002', name: 'Riya Sharma',   batchName: base.batch, scorePct: 91, status: 'appeared' },
      { id: 'c-3', rollNo: 'AOS1003', name: 'Karan Singh',   batchName: base.batch, scorePct: 89, status: 'appeared' },
      { id: 'c-4', rollNo: 'AOS1004', name: 'Vanshita Jain', batchName: base.batch, scorePct: 88, status: 'appeared' },
    ],

    questionPaperBlueprint: [
      { qNo: 1, section: 'Physics',     type: 'MCQ',       marks: 4, topic: 'Kinematics' },
      { qNo: 2, section: 'Physics',     type: 'Numerical', marks: 4, topic: 'Work & Energy' },
      { qNo: 3, section: 'Chemistry',   type: 'MCQ',       marks: 4, topic: 'Chemical Bonding' },
      { qNo: 4, section: 'Mathematics', type: 'MCQ',       marks: 4, topic: 'Definite Integrals' },
    ],

    timeline: [
      { id: 'tl-1', type: 'results_published',  title: 'Results Published', detail: 'Class average score 78%', date: '2025-05-15', actor: 'Academic Director' },
      { id: 'tl-2', type: 'test_conducted',     title: 'Test Conducted', detail: `${base.students} candidates attempted`, date: base.date, actor: 'Chief Invigilator' },
      { id: 'tl-3', type: 'blueprint_approved', title: 'Paper Blueprint Approved', detail: `${base.maxMarks} Marks paper verified`, date: '2025-05-01', actor: 'HOD Science' },
      { id: 'tl-4', type: 'scheduled',          title: 'Exam Scheduled', detail: `Created code ${base.code}`, date: '2025-04-20', actor: 'System Admin' },
    ],
  };
}

export const MOCK_EXAMS_ANALYTICS: ExamsAnalytics = {
  totalExams:        45,
  upcomingExams:     12,
  completedExams:    28,
  evaluationPending: 18,
  avgPassPercentage: 78,

  passPercentageTrend: [
    { month: 'Jan', passRate: 62 },
    { month: 'Feb', passRate: 65 },
    { month: 'Mar', passRate: 70 },
    { month: 'Apr', passRate: 74 },
    { month: 'May', passRate: 78 },
  ],

  topPerformers: [
    { rank: 1, name: 'Arjun Mehta',   score: '92.6%', avatar: 'AM' },
    { rank: 2, name: 'Riya Sharma',   score: '91.2%', avatar: 'RS' },
    { rank: 3, name: 'Karan Singh',   score: '89.8%', avatar: 'KS' },
    { rank: 4, name: 'Vanshita Jain', score: '88.4%', avatar: 'VJ' },
    { rank: 5, name: 'Devarsh Patel', score: '87.9%', avatar: 'DP' },
  ],

  examOverview: [
    { name: 'Mock Test',   value: 18, color: '#3b82f6', percent: '40%' },
    { name: 'Part Test',   value: 12, color: '#10b981', percent: '27%' },
    { name: 'Subjective',  value: 8,  color: '#8b5cf6', percent: '18%' },
    { name: 'Weekly Test', value: 5,  color: '#f59e0b', percent: '11%' },
    { name: 'DPP Test',    value: 2,  color: '#ef4444', percent: '4%' },
  ],

  evaluationStatus: [
    { name: 'Pending',     value: 18, color: '#f59e0b' },
    { name: 'In-Progress', value: 12, color: '#3b82f6' },
    { name: 'Completed',   value: 15, color: '#10b981' },
  ],

  operationalAlerts: [
    { id: 'alt-1', message: '18 evaluations pending grade publish', severity: 'high' },
    { id: 'alt-2', message: '3 question papers waiting for HOD approval', severity: 'medium' },
  ],
};
