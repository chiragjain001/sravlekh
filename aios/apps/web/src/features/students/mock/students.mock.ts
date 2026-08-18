// ─── Students Module: Mock Data ───────────────────────────────────────────────
// This is the single source of truth for the Students mock API.
// When a real backend is wired, ONLY the service layer changes. UI stays intact.

import type {
  StudentListItem,
  StudentProfile,
  StudentsAnalytics,
  EnrollmentPoint,
} from '../types/student.types';

// ─── Master Student List ──────────────────────────────────────────────────────
export const MOCK_STUDENTS: StudentListItem[] = [
  {
    id: 'st-001', rollNo: 'AOS24001', name: 'Ayush Singh',
    email: 'ayush.singh@aios.in', phone: '9876543210',
    avatarInitials: 'AS', program: 'JEE', batchId: 'b-001',
    batchLabel: 'JEE 2025 Star Batch', classLabel: 'Class 12',
    avgScore: 78, attendancePct: 92, weakTopicsCount: 3,
    rank: 12, lastActiveAt: new Date().toISOString(),
    feeStatus: 'paid', riskLevel: 'low', status: 'active',
    parentName: 'Rajesh Singh', parentPhone: '9988776655',
    enrolledAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'st-002', rollNo: 'AOS24002', name: 'Krisha Sharma',
    email: 'krisha.sharma@aios.in', phone: '9876543211',
    avatarInitials: 'KS', program: 'NEET', batchId: 'b-002',
    batchLabel: 'NEET 2025 Target', classLabel: 'Class 12',
    avgScore: 84, attendancePct: 89, weakTopicsCount: 2,
    rank: 6, lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    feeStatus: 'paid', riskLevel: 'low', status: 'active',
    parentName: 'Meena Sharma', parentPhone: '9988776644',
    enrolledAt: '2024-06-03T00:00:00Z',
  },
  {
    id: 'st-003', rollNo: 'AOS24003', name: 'Rohan Verma',
    email: 'rohan.verma@aios.in', phone: '9876543212',
    avatarInitials: 'RV', program: '11th', batchId: 'b-003',
    batchLabel: 'Foundation 11A', classLabel: 'Class 11',
    avgScore: 42, attendancePct: 65, weakTopicsCount: 6,
    rank: 89, lastActiveAt: new Date(Date.now() - 172800000).toISOString(),
    feeStatus: 'overdue', riskLevel: 'high', status: 'active',
    parentName: 'Suresh Verma', parentPhone: '9988776633',
    enrolledAt: '2024-07-15T00:00:00Z',
  },
  {
    id: 'st-004', rollNo: 'AOS24004', name: 'Megha Jain',
    email: 'megha.jain@aios.in', phone: '9876543213',
    avatarInitials: 'MJ', program: 'JEE', batchId: 'b-004',
    batchLabel: 'JEE 2026 Early', classLabel: 'Class 11',
    avgScore: 88, attendancePct: 95, weakTopicsCount: 1,
    rank: 3, lastActiveAt: new Date().toISOString(),
    feeStatus: 'paid', riskLevel: 'low', status: 'active',
    parentName: 'Priya Jain', parentPhone: '9988776622',
    enrolledAt: '2024-05-20T00:00:00Z',
  },
  {
    id: 'st-005', rollNo: 'AOS24005', name: 'Aditya Patel',
    email: 'aditya.patel@aios.in', phone: '9876543214',
    avatarInitials: 'AP', program: 'NEET', batchId: 'b-002',
    batchLabel: 'NEET 2025 Target', classLabel: 'Class 12',
    avgScore: 58, attendancePct: 72, weakTopicsCount: 4,
    rank: 41, lastActiveAt: new Date(Date.now() - 259200000).toISOString(),
    feeStatus: 'partial', riskLevel: 'medium', status: 'active',
    parentName: 'Hemant Patel', parentPhone: '9988776611',
    enrolledAt: '2024-06-10T00:00:00Z',
  },
  {
    id: 'st-006', rollNo: 'AOS24006', name: 'Vanaya Gupta',
    email: 'vanaya.gupta@aios.in', phone: '9876543215',
    avatarInitials: 'VG', program: '11th', batchId: 'b-003',
    batchLabel: 'Foundation 11A', classLabel: 'Class 11',
    avgScore: 35, attendancePct: 58, weakTopicsCount: 7,
    rank: 102, lastActiveAt: new Date(Date.now() - 345600000).toISOString(),
    feeStatus: 'overdue', riskLevel: 'critical', status: 'active',
    parentName: 'Rekha Gupta', parentPhone: '9988776600',
    enrolledAt: '2024-07-20T00:00:00Z',
  },
  {
    id: 'st-007', rollNo: 'AOS24007', name: 'Vivaan Mehta',
    email: 'vivaan.mehta@aios.in', phone: '9876543216',
    avatarInitials: 'VM', program: 'JEE', batchId: 'b-001',
    batchLabel: 'JEE 2025 Star Batch', classLabel: 'Class 12',
    avgScore: 82, attendancePct: 90, weakTopicsCount: 2,
    rank: 8, lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    feeStatus: 'paid', riskLevel: 'low', status: 'active',
    parentName: 'Sanjay Mehta', parentPhone: '9988776599',
    enrolledAt: '2024-06-05T00:00:00Z',
  },
  {
    id: 'st-008', rollNo: 'AOS24008', name: 'Ishita Rawat',
    email: 'ishita.rawat@aios.in', phone: '9876543217',
    avatarInitials: 'IR', program: 'NEET', batchId: 'b-002',
    batchLabel: 'NEET 2025 Target', classLabel: 'Class 12',
    avgScore: 76, attendancePct: 83, weakTopicsCount: 3,
    rank: 19, lastActiveAt: new Date().toISOString(),
    feeStatus: 'paid', riskLevel: 'medium', status: 'active',
    parentName: 'Geeta Rawat', parentPhone: '9988776588',
    enrolledAt: '2024-06-08T00:00:00Z',
  },
  {
    id: 'st-009', rollNo: 'AOS24009', name: 'Siddharth Rao',
    email: 'siddharth.rao@aios.in', phone: '9876543218',
    avatarInitials: 'SR', program: 'JEE', batchId: 'b-001',
    batchLabel: 'JEE 2025 Star Batch', classLabel: 'Class 12',
    avgScore: 71, attendancePct: 79, weakTopicsCount: 4,
    rank: 28, lastActiveAt: new Date(Date.now() - 432000000).toISOString(),
    feeStatus: 'paid', riskLevel: 'medium', status: 'active',
    parentName: 'Ramesh Rao', parentPhone: '9988776577',
    enrolledAt: '2024-06-12T00:00:00Z',
  },
  {
    id: 'st-010', rollNo: 'AOS24010', name: 'Pooja Nair',
    email: 'pooja.nair@aios.in', phone: '9876543219',
    avatarInitials: 'PN', program: 'NEET', batchId: 'b-002',
    batchLabel: 'NEET 2025 Target', classLabel: 'Class 12',
    avgScore: 80, attendancePct: 88, weakTopicsCount: 2,
    rank: 14, lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
    feeStatus: 'paid', riskLevel: 'low', status: 'active',
    parentName: 'Latha Nair', parentPhone: '9988776566',
    enrolledAt: '2024-06-15T00:00:00Z',
  },
  {
    id: 'st-011', rollNo: 'AOS24011', name: 'Devanshi Yadav',
    email: 'devanshi.yadav@aios.in', phone: '9876543220',
    avatarInitials: 'DY', program: '11th', batchId: 'b-003',
    batchLabel: 'Foundation 11A', classLabel: 'Class 11',
    avgScore: 61, attendancePct: 74, weakTopicsCount: 5,
    rank: 55, lastActiveAt: new Date(Date.now() - 259200000).toISOString(),
    feeStatus: 'partial', riskLevel: 'medium', status: 'active',
    parentName: 'Rakesh Yadav', parentPhone: '9988776555',
    enrolledAt: '2024-07-01T00:00:00Z',
  },
  {
    id: 'st-012', rollNo: 'AOS24012', name: 'Aryan Mishra',
    email: 'aryan.mishra@aios.in', phone: '9876543221',
    avatarInitials: 'AM', program: 'JEE', batchId: 'b-004',
    batchLabel: 'JEE 2026 Early', classLabel: 'Class 11',
    avgScore: 69, attendancePct: 81, weakTopicsCount: 4,
    rank: 32, lastActiveAt: new Date().toISOString(),
    feeStatus: 'paid', riskLevel: 'low', status: 'active',
    parentName: 'Vijay Mishra', parentPhone: '9988776544',
    enrolledAt: '2024-05-25T00:00:00Z',
  },
];

// ─── Student Profile (detail view) ───────────────────────────────────────────
export function buildStudentProfile(base: StudentListItem): StudentProfile {
  return {
    ...base,
    testHistory: [
      { testId: 't-1', testName: 'JEE Main Mock Test 08', date: '2025-05-20', score: Math.round(base.avgScore * 1.05), maxScore: 100, pct: Math.round(base.avgScore * 1.05), rank: base.rank ? base.rank - 2 : null, batchRank: base.rank },
      { testId: 't-2', testName: 'JEE Main Mock Test 07', date: '2025-05-13', score: Math.round(base.avgScore * 0.98), maxScore: 100, pct: Math.round(base.avgScore * 0.98), rank: base.rank ? base.rank + 1 : null, batchRank: base.rank ? base.rank + 2 : null },
      { testId: 't-3', testName: 'Unit Test 06', date: '2025-05-06', score: Math.round(base.avgScore * 0.91), maxScore: 100, pct: Math.round(base.avgScore * 0.91), rank: base.rank ? base.rank + 4 : null, batchRank: base.rank ? base.rank + 5 : null },
      { testId: 't-4', testName: 'Unit Test 05', date: '2025-04-29', score: Math.round(base.avgScore * 0.85), maxScore: 100, pct: Math.round(base.avgScore * 0.85), rank: base.rank ? base.rank + 6 : null, batchRank: base.rank ? base.rank + 8 : null },
    ],
    subjectScores: [
      { subject: 'Physics',   score: Math.round(base.avgScore * 1.06), color: '#6366f1' },
      { subject: 'Chemistry', score: Math.round(base.avgScore * 0.97), color: '#06b6d4' },
      { subject: 'Mathematics', score: Math.round(base.avgScore * 0.93), color: '#8b5cf6' },
    ],
    attendanceHistory: [
      { month: 'Jan', present: 22, absent: 2, total: 24, pct: 92 },
      { month: 'Feb', present: 20, absent: 4, total: 24, pct: 83 },
      { month: 'Mar', present: Math.round(base.attendancePct / 4), absent: 6, total: 26, pct: base.attendancePct - 5 },
      { month: 'Apr', present: Math.round(base.attendancePct / 4), absent: 4, total: 26, pct: base.attendancePct },
      { month: 'May', present: Math.round(base.attendancePct / 4), absent: 3, total: 22, pct: base.attendancePct + 3 > 100 ? 100 : base.attendancePct + 3 },
    ],
    weakTopics: ([
      { topic: 'Rotational Motion', subject: 'Physics',   mastery: 42, trend: 'up'   as const },
      { topic: 'Integrals',         subject: 'Maths',     mastery: 38, trend: 'flat' as const },
      { topic: 'Chemical Bonding',  subject: 'Chemistry', mastery: 55, trend: 'down' as const },
    ] as import('../types/student.types').StudentWeakTopic[]).slice(0, base.weakTopicsCount > 3 ? 3 : base.weakTopicsCount),
    aiInsights: [
      ...(base.riskLevel === 'high' || base.riskLevel === 'critical' ? [
        { type: 'warning' as const, message: 'Attendance below threshold. Parent notification recommended.', action: 'Notify Parent' },
        { type: 'warning' as const, message: `Scoring ${base.avgScore}% — below institute average of 72%.`, action: 'Schedule Intervention' },
      ] : [
        { type: 'success' as const, message: 'Performance trending upward for 3 consecutive tests.', action: null },
      ]),
      { type: 'info' as const, message: 'Fee reminders sent for the last 2 months.', action: null },
    ],
    assignmentStats: {
      total: 18, submitted: 14, graded: 12, overdue: 2,
    },
    timeline: [
      { id: 'tl-1', type: 'test',        title: 'Scored 82% in Mock Test 08',           detail: 'Rank improved by 2 positions',          date: '2025-05-20', actor: 'System'       },
      { id: 'tl-2', type: 'fee',         title: 'Fee payment received – ₹18,500',        detail: base.feeStatus === 'overdue' ? 'Overdue by 45 days' : 'On time', date: '2025-05-15', actor: 'Admin NM' },
      { id: 'tl-3', type: 'attendance',  title: 'Missed 3 consecutive classes',          detail: 'Physics – Rahul Sir',                   date: '2025-05-10', actor: 'System'       },
      { id: 'tl-4', type: 'enrolled',    title: 'Enrolled in JEE 2025 Star Batch',       detail: `Roll: ${base.rollNo}`,                  date: base.enrolledAt.slice(0, 10), actor: 'Admin NM' },
    ],
  };
}

// ─── Analytics Data ───────────────────────────────────────────────────────────
export const MOCK_STUDENTS_ANALYTICS: StudentsAnalytics = {
  totalStudents:  1284,
  activeStudents: 1142,
  atRiskCount:    86,
  newAdmissions:  126,

  enrollmentTrend: [
    { month: 'Jan', count: 950 },
    { month: 'Feb', count: 1020 },
    { month: 'Mar', count: 1100 },
    { month: 'Apr', count: 1180 },
    { month: 'May', count: 1240 },
    { month: 'Jun', count: 1284 },
  ] as EnrollmentPoint[],

  feeBreakdown: [
    { label: 'Paid',    value: 974, color: '#10b981' },
    { label: 'Partial', value: 146, color: '#f59e0b' },
    { label: 'Overdue', value: 164, color: '#ef4444' },
  ],

  subjectGapMap: [
    { subject: 'Physics',     gap: 28, color: '#6366f1' },
    { subject: 'Mathematics', gap: 32, color: '#8b5cf6' },
    { subject: 'Chemistry',   gap: 24, color: '#06b6d4' },
    { subject: 'Biology',     gap: 18, color: '#10b981' },
  ],

  riskDistribution: [
    { level: 'Low',      count: 840, color: '#10b981' },
    { level: 'Medium',   count: 278, color: '#f59e0b' },
    { level: 'High',     count: 124, color: '#ef4444' },
    { level: 'Critical', count: 42,  color: '#7f1d1d' },
  ],

  batchPerformance: [
    { batch: 'JEE 2025 Star',  avg: 82, attendance: 91 },
    { batch: 'NEET 2025',      avg: 78, attendance: 88 },
    { batch: 'Foundation 11A', avg: 64, attendance: 75 },
    { batch: 'JEE 2026 Early', avg: 71, attendance: 83 },
  ],
};
