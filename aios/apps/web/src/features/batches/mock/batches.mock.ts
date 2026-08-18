// ─── Batches Module: Mock Data Layer ───────────────────────────────────────────

import type {
  BatchListItem,
  BatchProfile,
  BatchesAnalytics,
} from '../types/batch.types';

export const MOCK_BATCHES: BatchListItem[] = [
  {
    id: 'b-001', code: 'B-JEE-2025-01', name: 'JEE 2025 Star Batch',
    program: 'JEE', targetYear: '2025', branchName: 'Main Campus',
    enrolledStudents: 34, maxCapacity: 40,
    leadMentor: 'Rahul Verma', mentorAvatar: 'RV', facultyCount: 4,
    attendancePct: 92, avgScore: 84, syllabusProgress: 72,
    nextTestName: 'JEE Main Mock 08', nextTestDate: '2025-05-24',
    status: 'active', startDate: '2024-04-01', endDate: '2025-05-30',
  },
  {
    id: 'b-002', code: 'B-NEET-2025-01', name: 'NEET 2025 Target Batch',
    program: 'NEET', targetYear: '2025', branchName: 'Main Campus',
    enrolledStudents: 35, maxCapacity: 40,
    leadMentor: 'Pooja Sharma', mentorAvatar: 'PS', facultyCount: 3,
    attendancePct: 88, avgScore: 82, syllabusProgress: 60,
    nextTestName: 'NEET Unit Test 05', nextTestDate: '2025-05-26',
    status: 'active', startDate: '2024-04-15', endDate: '2025-05-30',
  },
  {
    id: 'b-003', code: 'B-FND-11A', name: 'Foundation 11A',
    program: 'Class 11', targetYear: '2024-25', branchName: 'North Wing',
    enrolledStudents: 30, maxCapacity: 35,
    leadMentor: 'Amit Singh', mentorAvatar: 'AS', facultyCount: 3,
    attendancePct: 81, avgScore: 70, syllabusProgress: 45,
    nextTestName: 'Maths Chapter Test', nextTestDate: '2025-05-27',
    status: 'active', startDate: '2024-06-01', endDate: '2025-03-31',
  },
  {
    id: 'b-004', code: 'B-JEE-2026-01', name: 'JEE 2026 Early Batch',
    program: 'JEE', targetYear: '2026', branchName: 'Main Campus',
    enrolledStudents: 28, maxCapacity: 40,
    leadMentor: 'Devendra Pal', mentorAvatar: 'DP', facultyCount: 4,
    attendancePct: 90, avgScore: 79, syllabusProgress: 56,
    nextTestName: 'Physics Test 03', nextTestDate: '2025-05-30',
    status: 'active', startDate: '2024-07-01', endDate: '2026-04-30',
  },
  {
    id: 'b-005', code: 'B-FND-11B', name: 'Foundation 11B',
    program: 'Class 11', targetYear: '2024-25', branchName: 'South Branch',
    enrolledStudents: 25, maxCapacity: 35,
    leadMentor: 'Sunidhi Mehta', mentorAvatar: 'SM', facultyCount: 3,
    attendancePct: 76, avgScore: 62, syllabusProgress: 38,
    nextTestName: 'Chemistry Quiz 02', nextTestDate: '2025-05-28',
    status: 'active', startDate: '2024-06-15', endDate: '2025-03-31',
  },
  {
    id: 'b-006', code: 'B-JEE-DROP-01', name: 'JEE Droppers 2026',
    program: 'JEE', targetYear: '2026', branchName: 'Main Campus',
    enrolledStudents: 38, maxCapacity: 40,
    leadMentor: 'Vikram Rao', mentorAvatar: 'VR', facultyCount: 4,
    attendancePct: 79, avgScore: 65, syllabusProgress: 42,
    nextTestName: 'Full Length Test 01', nextTestDate: '2025-06-02',
    status: 'active', startDate: '2024-08-01', endDate: '2026-05-15',
  },
];

export function buildBatchProfile(base: BatchListItem): BatchProfile {
  return {
    ...base,
    roomNo: 'Hall A - Floor 2',
    scheduleSummary: 'Mon, Wed, Fri (09:00 AM - 01:00 PM)',
    description: `Flagship ${base.program} cohort for high-ranking aspirants aiming for top tier ranks in ${base.targetYear}.`,

    enrolledStudentsList: [
      { id: 'st-001', rollNo: 'AOS1001', name: 'Aryan Sharma', avgScore: 94, attendancePct: 96, riskLevel: 'low' },
      { id: 'st-002', rollNo: 'AOS1002', name: 'Priya Patel',  avgScore: 89, attendancePct: 92, riskLevel: 'low' },
      { id: 'st-003', rollNo: 'AOS1003', name: 'Rohan Gupta',  avgScore: 78, attendancePct: 85, riskLevel: 'medium' },
      { id: 'st-004', rollNo: 'AOS1004', name: 'Ananya Roy',   avgScore: 61, attendancePct: 74, riskLevel: 'high' },
    ],

    assignedFaculty: [
      { id: 'tch-001', name: base.leadMentor, subject: 'Physics',     weeklyHours: 8 },
      { id: 'tch-002', name: 'Pooja Sharma',    subject: 'Chemistry',   weeklyHours: 6 },
      { id: 'tch-003', name: 'Amit Singh',      subject: 'Mathematics', weeklyHours: 6 },
    ],

    upcomingTests: [
      { id: 't-101', title: base.nextTestName, date: base.nextTestDate, maxMarks: 300, status: 'scheduled' },
      { id: 't-102', title: `${base.program} Unit Test 09`, date: '2025-06-10', maxMarks: 180, status: 'scheduled' },
    ],

    syllabusChapters: [
      { subject: 'Physics',   chapterName: 'Rotational Motion', completedPct: 100, status: 'completed' },
      { subject: 'Physics',   chapterName: 'Electromagnetism',  completedPct: 65,  status: 'in_progress' },
      { subject: 'Chemistry', chapterName: 'Organic Reaction Mechanisms', completedPct: 80, status: 'in_progress' },
      { subject: 'Maths',     chapterName: 'Definite Integrals', completedPct: 40, status: 'in_progress' },
    ],

    timeline: [
      { id: 'btl-1', type: 'test_conducted', title: 'Conduct JEE Mock Test 07', detail: 'Class average score: 81%', date: '2025-05-10', actor: base.leadMentor },
      { id: 'btl-2', type: 'milestone', title: 'Completed 70% Syllabus Milestone', detail: 'Physics & Chemistry modules cleared', date: '2025-04-20', actor: 'Academic Director' },
      { id: 'btl-3', type: 'mentor_assigned', title: `Assigned Lead Mentor: ${base.leadMentor}`, detail: 'Lead Faculty Assignment', date: '2024-04-01', actor: 'Admin' },
      { id: 'btl-4', type: 'created', title: `Batch Created (${base.name})`, detail: `Target year ${base.targetYear}`, date: base.startDate, actor: 'System Admin' },
    ],
  };
}

export const MOCK_BATCHES_ANALYTICS: BatchesAnalytics = {
  totalBatches:    48,
  activeCohorts:   42,
  avgCapacityPct:  88,
  upcomingBatches: 6,

  capacityUtilization: [
    { name: 'Enrolled Seats',  value: 1300, color: '#3b82f6' },
    { name: 'Available Seats', value: 372,  color: '#10b981' },
  ],

  cohortComparison: [
    { name: 'JEE Star',   avgScore: 84, attendance: 92 },
    { name: 'NEET Target',avgScore: 82, attendance: 88 },
    { name: 'JEE Early',  avgScore: 79, attendance: 90 },
    { name: 'Fnd 11A',    avgScore: 70, attendance: 81 },
    { name: 'JEE Drop',   avgScore: 65, attendance: 79 },
    { name: 'Fnd 11B',    avgScore: 62, attendance: 76 },
  ],

  topBatches: [
    { name: 'JEE 2025 Star Batch', mentor: 'Rahul Verma', score: 84 },
    { name: 'NEET 2025 Target Batch', mentor: 'Pooja Sharma', score: 82 },
    { name: 'JEE 2026 Early Batch', mentor: 'Devendra Pal', score: 79 },
  ],

  attentionRequired: [
    { name: 'Foundation 11B', mentor: 'Sunidhi Mehta', score: 62, reason: 'Low attendance & test averages' },
    { name: 'JEE Droppers 2026', mentor: 'Vikram Rao', score: 65, reason: 'High test variance across topics' },
  ],
};
