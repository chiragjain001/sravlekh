// ─── Teachers Module: Mock Data ───────────────────────────────────────────────

import type {
  TeacherListItem,
  TeacherProfile,
  TeachersAnalytics,
} from '../types/teacher.types';

export const MOCK_TEACHERS: TeacherListItem[] = [
  {
    id: 'tch-001', empId: 'EMP1001', name: 'Rahul Verma',
    email: 'rahul.verma@aios.in', phone: '9876500001',
    avatarInitials: 'RV', designation: 'Senior Faculty', role: 'teacher',
    subject: 'Physics', subjects: ['Physics', 'Mechanics'],
    assignedBatches: 4, batchLabels: ['JEE 2025 Star', 'JEE 2026 Early', 'Foundation 11A', 'Droppers A'],
    weeklyClasses: 18, pendingEvaluations: 1, avgStudentScore: 82,
    workloadPct: 85, availability: 'available', rating: 4.8,
    joinedOn: '2022-03-15T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-002', empId: 'EMP1002', name: 'Pooja Sharma',
    email: 'pooja.sharma@aios.in', phone: '9876500002',
    avatarInitials: 'PS', designation: 'Head of Chemistry', role: 'head_of_dept',
    subject: 'Chemistry', subjects: ['Organic Chem', 'Inorganic Chem'],
    assignedBatches: 3, batchLabels: ['NEET 2025 Target', 'NEET 2026 Early', 'Class 11 B'],
    weeklyClasses: 15, pendingEvaluations: 0, avgStudentScore: 89,
    workloadPct: 70, availability: 'available', rating: 4.9,
    joinedOn: '2021-06-10T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-003', empId: 'EMP1003', name: 'Amit Singh',
    email: 'amit.singh@aios.in', phone: '9876500003',
    avatarInitials: 'AS', designation: 'Senior Maths Faculty', role: 'teacher',
    subject: 'Mathematics', subjects: ['Calculus', 'Algebra', 'Trigonometry'],
    assignedBatches: 5, batchLabels: ['JEE 2025 Star', 'JEE 2026 Early', 'Foundation 11A', 'Droppers A', 'Super 30'],
    weeklyClasses: 20, pendingEvaluations: 2, avgStudentScore: 78,
    workloadPct: 95, availability: 'busy', rating: 4.6,
    joinedOn: '2020-01-20T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-004', empId: 'EMP1004', name: 'Neha Gupta',
    email: 'neha.gupta@aios.in', phone: '9876500004',
    avatarInitials: 'NG', designation: 'Biology Faculty', role: 'teacher',
    subject: 'Biology', subjects: ['Botany', 'Zoology'],
    assignedBatches: 3, batchLabels: ['NEET 2025 Target', 'NEET 2026 Early', 'Foundation 11B'],
    weeklyClasses: 14, pendingEvaluations: 0, avgStudentScore: 84,
    workloadPct: 65, availability: 'available', rating: 4.7,
    joinedOn: '2023-04-01T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-005', empId: 'EMP1005', name: 'Sunidhi Mehta',
    email: 'sunidhi.mehta@aios.in', phone: '9876500005',
    avatarInitials: 'SM', designation: 'Physical Edu. Faculty', role: 'teacher',
    subject: 'Physical Edu.', subjects: ['Physical Education', 'Health'],
    assignedBatches: 2, batchLabels: ['Class 11 A', 'Class 12 A'],
    weeklyClasses: 10, pendingEvaluations: 1, avgStudentScore: 86,
    workloadPct: 50, availability: 'available', rating: 4.5,
    joinedOn: '2023-08-15T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-006', empId: 'EMP1006', name: 'Vikram Rao',
    email: 'vikram.rao@aios.in', phone: '9876500006',
    avatarInitials: 'VR', designation: 'English Faculty', role: 'teacher',
    subject: 'English', subjects: ['English Lit', 'Grammar'],
    assignedBatches: 2, batchLabels: ['Class 11 A', 'Class 12 A'],
    weeklyClasses: 8, pendingEvaluations: 0, avgStudentScore: 79,
    workloadPct: 40, availability: 'available', rating: 4.4,
    joinedOn: '2022-11-10T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-007', empId: 'EMP1007', name: 'Anjali Nair',
    email: 'anjali.nair@aios.in', phone: '9876500007',
    avatarInitials: 'AN', designation: 'Assistant Faculty', role: 'adjunct_faculty',
    subject: 'Chemistry', subjects: ['Inorganic Chem'],
    assignedBatches: 2, batchLabels: ['Foundation 11A', 'Foundation 11B'],
    weeklyClasses: 9, pendingEvaluations: 1, avgStudentScore: 81,
    workloadPct: 45, availability: 'available', rating: 4.3,
    joinedOn: '2024-01-05T00:00:00Z', status: 'active',
  },
  {
    id: 'tch-008', empId: 'EMP1008', name: 'Devendra Pal',
    email: 'devendra.pal@aios.in', phone: '9876500008',
    avatarInitials: 'DP', designation: 'Maths Faculty', role: 'teacher',
    subject: 'Mathematics', subjects: ['Coordinate Geometry', 'Vectors'],
    assignedBatches: 4, batchLabels: ['JEE 2025 Star', 'NEET Target', 'Foundation 11A', 'Droppers B'],
    weeklyClasses: 16, pendingEvaluations: 2, avgStudentScore: 77,
    workloadPct: 80, availability: 'busy', rating: 4.5,
    joinedOn: '2021-09-01T00:00:00Z', status: 'active',
  },
];

export function buildTeacherProfile(base: TeacherListItem): TeacherProfile {
  return {
    ...base,
    qualification: 'M.Sc. Physics (IIT Delhi), B.Ed.',
    experienceYears: 8,
    bio: 'Specialist in Rotational Dynamics & Electromagnetism with 8+ years coaching JEE Advanced rankers.',
    schedule: [
      { id: 's-1', day: 'Mon', timeSlot: '09:00 - 10:30 AM', batchName: 'JEE 2025 Star', roomNo: 'Hall A', subject: base.subject },
      { id: 's-2', day: 'Mon', timeSlot: '11:00 - 12:30 PM', batchName: 'Foundation 11A', roomNo: 'Room 204', subject: base.subject },
      { id: 's-3', day: 'Wed', timeSlot: '02:00 - 03:30 PM', batchName: 'JEE 2026 Early', roomNo: 'Hall B', subject: base.subject },
      { id: 's-4', day: 'Thu', timeSlot: '09:00 - 10:30 AM', batchName: 'Droppers A', roomNo: 'Hall A', subject: base.subject },
      { id: 's-5', day: 'Fri', timeSlot: '04:00 - 05:30 PM', batchName: 'Doubt Session', roomNo: 'Doubt Lab 1', subject: base.subject },
    ],
    batchDetails: base.batchLabels.map((bName, idx) => ({
      batchId: `b-00${idx + 1}`,
      batchName: bName,
      studentCount: 35 + idx * 8,
      avgBatchScore: Math.round(base.avgStudentScore + (idx % 2 === 0 ? 3 : -4)),
      attendanceRate: 88 + (idx % 3),
    })),
    appraisals: [
      { id: 'ap-1', period: 'Q1 2025', rating: base.rating, feedback: 'Excellent syllabus completion rate and positive student feedback.', evaluatedBy: 'Academic Director', date: '2025-04-10' },
      { id: 'ap-2', period: 'Q4 2024', rating: base.rating - 0.1, feedback: 'Great performance in test preparation & paper blueprint creation.', evaluatedBy: 'HOD', date: '2025-01-08' },
    ],
    pendingPapers: [
      { id: 'pap-1', paperTitle: `${base.subject} Unit Test 08`, batchName: base.batchLabels[0] ?? 'JEE 2025', totalQuestions: 30, submittedAt: '2025-05-21', status: 'pending' },
    ],
    leaveRequests: [
      { id: 'lv-1', reason: 'Attending National Education Seminar', fromDate: '2025-06-02', toDate: '2025-06-03', status: 'approved', substitute: 'Sunidhi Mehta' },
    ],
    timeline: [
      { id: 'tl-1', type: 'paper_submitted', title: `Submitted ${base.subject} Mock Paper 08`, detail: 'Waiting for academic director approval', date: '2025-05-21', actor: base.name },
      { id: 'tl-2', type: 'appraisal', title: `Quarterly Appraisal Completed (${base.rating}/5)`, detail: 'Rated by Academic Director', date: '2025-04-10', actor: 'Director' },
      { id: 'tl-3', type: 'batch_assigned', title: `Assigned to ${base.batchLabels[0] ?? 'New Batch'}`, detail: 'Lead Subject Faculty', date: '2025-01-05', actor: 'Admin' },
      { id: 'tl-4', type: 'joined', title: 'Joined AIOS Institute Faculty', detail: base.designation, date: base.joinedOn.slice(0, 10), actor: 'HR Admin' },
    ],
  };
}

export const MOCK_TEACHERS_ANALYTICS: TeachersAnalytics = {
  totalTeachers:     96,
  activeToday:       88,
  avgWorkloadHours:  18.4,
  pendingAppraisals: 5,

  subjectCoverage: [
    { subject: 'Physics',     teacherCount: 24, color: '#6366f1' },
    { subject: 'Chemistry',   teacherCount: 22, color: '#06b6d4' },
    { subject: 'Mathematics', teacherCount: 26, color: '#8b5cf6' },
    { subject: 'Biology',     teacherCount: 16, color: '#10b981' },
    { subject: 'English',     teacherCount: 8,  color: '#f59e0b' },
  ],

  workloadDistribution: [
    { range: 'Light (< 12h)',   count: 14, color: '#10b981' },
    { range: 'Optimal (12-18h)',count: 58, color: '#6366f1' },
    { range: 'Heavy (18-22h)',  count: 18, color: '#f59e0b' },
    { range: 'Critical (> 22h)',count: 6,  color: '#ef4444' },
  ],

  topPerformers: [
    { rank: 1, name: 'Pooja Sharma', subject: 'Chemistry', score: '89%', avatar: 'PS' },
    { rank: 2, name: 'Sunidhi Mehta', subject: 'Physical Edu.', score: '86%', avatar: 'SM' },
    { rank: 3, name: 'Neha Gupta', subject: 'Biology', score: '84%', avatar: 'NG' },
    { rank: 4, name: 'Rahul Verma', subject: 'Physics', score: '82%', avatar: 'RV' },
    { rank: 5, name: 'Anjali Nair', subject: 'Chemistry', score: '81%', avatar: 'AN' },
  ],

  departmentBreakdown: [
    { dept: 'Physics',     totalHours: 380, avgRating: 4.7 },
    { dept: 'Chemistry',   totalHours: 340, avgRating: 4.8 },
    { dept: 'Mathematics', totalHours: 420, avgRating: 4.6 },
    { dept: 'Biology',     totalHours: 250, avgRating: 4.7 },
  ],
};
