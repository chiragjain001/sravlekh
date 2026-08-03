// ─── Database-aligned teacher mock data ─────────────────────────────────────
// Every entity here maps 1:1 to a future database table/collection.
// IDs use the same format as the planned API schema.

export const teacherProfile = {
  id:          'TCH-2023-042',
  name:        'Rahul Verma',
  email:       'rahul.verma@sarvlekh.com',
  phone:       '+91 98765 43210',
  designation: 'Physics Teacher',
  role:        'TEACHER' as const,
  avatarInitials: 'RV',
  joinedOn:    '2023-06-01',
  // Which classes + subjects this teacher is assigned to
  assignments: [
    { classId: '11', subjectId: 'physics' },
    { classId: '12', subjectId: 'physics' },
  ],
};

// ─── Classes ─────────────────────────────────────────────────────────────────
// Table: classes
export const classes = [
  { id: '11', label: 'Class 11' },
  { id: '12', label: 'Class 12' },
];

// ─── Subjects ────────────────────────────────────────────────────────────────
// Table: subjects
export const subjects = [
  { id: 'physics', label: 'Physics' },
];

// ─── Batches ─────────────────────────────────────────────────────────────────
// Table: batches  FK: classId, subjectId, teacherId
export const batches = [
  { id: '11A', classId: '11', subjectId: 'physics', label: '11A', strength: 48, avgScore: 74, trend: 'up',   pendingActions: 2 },
  { id: '11B', classId: '11', subjectId: 'physics', label: '11B', strength: 46, avgScore: 68, trend: 'down', pendingActions: 4 },
  { id: '11C', classId: '11', subjectId: 'physics', label: '11C', strength: 44, avgScore: 71, trend: 'up',   pendingActions: 1 },
  { id: '12A', classId: '12', subjectId: 'physics', label: '12A', strength: 50, avgScore: 79, trend: 'up',   pendingActions: 1 },
  { id: '12B', classId: '12', subjectId: 'physics', label: '12B', strength: 45, avgScore: 72, trend: 'flat', pendingActions: 3 },
  { id: '12C', classId: '12', subjectId: 'physics', label: '12C', strength: 43, avgScore: 65, trend: 'down', pendingActions: 2 },
];

// ─── Students ────────────────────────────────────────────────────────────────
// Table: students  FK: batchId, classId, subjectId
export const students = [
  { id: 'STU-001', batchId: '11A', name: 'Sneha Patel',  rollNo: '11A-004', avgScore: 91, lastTestScore: 94, lastTestMax: 100, status: 'excellent', rank: 1 },
  { id: 'STU-002', batchId: '11A', name: 'Aryan Sharma', rollNo: '11A-001', avgScore: 88, lastTestScore: 85, lastTestMax: 100, status: 'excellent', rank: 2 },
  { id: 'STU-003', batchId: '11A', name: 'Kavya Nair',   rollNo: '11A-006', avgScore: 77, lastTestScore: 73, lastTestMax: 100, status: 'good',      rank: 3 },
  { id: 'STU-004', batchId: '11A', name: 'Priya Gupta',  rollNo: '11A-002', avgScore: 72, lastTestScore: 68, lastTestMax: 100, status: 'good',      rank: 4 },
  { id: 'STU-005', batchId: '11A', name: 'Amit Singh',   rollNo: '11A-005', avgScore: 60, lastTestScore: 58, lastTestMax: 100, status: 'average',   rank: 5 },
  { id: 'STU-006', batchId: '11A', name: 'Ravi Kumar',   rollNo: '11A-003', avgScore: 54, lastTestScore: 50, lastTestMax: 100, status: 'weak',      rank: 6 },
];

// ─── Student Topic Mastery ────────────────────────────────────────────────────
// Table: student_topic_mastery  FK: studentId, topicId
export const studentTopicMastery = {
  'STU-001': [
    { topic: 'Rotational Motion', mastery: 91, attempts: 3, trend: 'up' },
    { topic: 'Thermodynamics',    mastery: 88, attempts: 2, trend: 'up' },
    { topic: 'Optics',            mastery: 95, attempts: 2, trend: 'up' },
    { topic: 'Work-Energy',       mastery: 90, attempts: 3, trend: 'up' },
  ],
  'STU-002': [
    { topic: 'Rotational Motion', mastery: 61, attempts: 3, trend: 'down' },
    { topic: 'Thermodynamics',    mastery: 78, attempts: 2, trend: 'flat' },
    { topic: 'Optics',            mastery: 92, attempts: 2, trend: 'up' },
    { topic: 'Work-Energy',       mastery: 84, attempts: 3, trend: 'up' },
  ],
  'STU-006': [
    { topic: 'Rotational Motion', mastery: 38, attempts: 3, trend: 'down' },
    { topic: 'Thermodynamics',    mastery: 42, attempts: 2, trend: 'down' },
    { topic: 'Optics',            mastery: 65, attempts: 2, trend: 'flat' },
    { topic: 'Work-Energy',       mastery: 55, attempts: 3, trend: 'flat' },
  ],
};

// ─── Student Test History ─────────────────────────────────────────────────────
export const studentTestHistory = {
  'STU-002': [
    { testId: 'T1', testName: 'JEE Mock Test 07',    date: '3 May 2025',  score: 85, maxScore: 100, rankInBatch: 3 },
    { testId: 'T2', testName: 'Physics Unit Test 05', date: '28 Apr 2025', score: 68, maxScore: 100, rankInBatch: 7 },
    { testId: 'T3', testName: 'Physics Unit Test 04', date: '20 Apr 2025', score: 72, maxScore: 100, rankInBatch: 4 },
  ],
  'STU-006': [
    { testId: 'T1', testName: 'JEE Mock Test 07',    date: '3 May 2025',  score: 50, maxScore: 100, rankInBatch: 46 },
    { testId: 'T2', testName: 'Physics Unit Test 05', date: '28 Apr 2025', score: 48, maxScore: 100, rankInBatch: 47 },
    { testId: 'T3', testName: 'Physics Unit Test 04', date: '20 Apr 2025', score: 52, maxScore: 100, rankInBatch: 45 },
  ],
};

// ─── Tests ───────────────────────────────────────────────────────────────────
// Table: tests  FK: batchId, subjectId, paperBuilderId
export const tests = [
  { id: 'T1', batchId: '11A', name: 'JEE Main Mock Test 07',    date: '3 May 2025',  totalStudents: 48, attempted: 48, graded: 9,  avgScore: 76, topScore: 98, status: 'grading'   },
  { id: 'T2', batchId: '11A', name: 'Physics Unit Test 05',     date: '28 Apr 2025', totalStudents: 48, attempted: 48, graded: 48, avgScore: 70, topScore: 95, status: 'completed'  },
  { id: 'T3', batchId: '11A', name: 'Physics Unit Test 04',     date: '20 Apr 2025', totalStudents: 48, attempted: 48, graded: 48, avgScore: 68, topScore: 91, status: 'completed'  },
  { id: 'T4', batchId: '11A', name: 'Chapter Test – Kinematics',date: '15 Apr 2025', totalStudents: 48, attempted: 48, graded: 48, avgScore: 74, topScore: 96, status: 'completed'  },
  { id: 'T5', batchId: '11A', name: 'JEE Main Mock Test 08',    date: '10 May 2025', totalStudents: 48, attempted: 0,  graded: 0,  avgScore: 0,  topScore: 0,  status: 'scheduled'  },
  { id: 'T6', batchId: '11A', name: 'Thermodynamics Test',      date: '12 May 2025', totalStudents: 48, attempted: 0,  graded: 0,  avgScore: 0,  topScore: 0,  status: 'draft'      },
];

// ─── Test Question Analysis ───────────────────────────────────────────────────
export const testQuestionAnalysis = {
  'T1': [
    { q: 'Q1',  topic: 'Rotational Motion', subtopic: 'Torque',           correctPct: 34, difficulty: 'Hard',   avgTimeSec: 252 },
    { q: 'Q2',  topic: 'Rotational Motion', subtopic: 'Angular Momentum', correctPct: 41, difficulty: 'Hard',   avgTimeSec: 228 },
    { q: 'Q8',  topic: 'Optics',            subtopic: 'Refraction',       correctPct: 89, difficulty: 'Medium', avgTimeSec: 72  },
    { q: 'Q12', topic: 'Thermodynamics',    subtopic: 'Carnot Engine',    correctPct: 62, difficulty: 'Medium', avgTimeSec: 126 },
  ],
};

// ─── Evaluation (per test, per student) ──────────────────────────────────────
// Table: evaluations  FK: testId, studentId
export const evaluations = {
  'T1': [
    { studentId: 'STU-001', name: 'Sneha Patel',  rollNo: '11A-004', marksObtained: 45, totalMarks: 50, status: 'graded'  },
    { studentId: 'STU-002', name: 'Aryan Sharma', rollNo: '11A-001', marksObtained: 38, totalMarks: 50, status: 'graded'  },
    { studentId: 'STU-003', name: 'Kavya Nair',   rollNo: '11A-006', marksObtained: 33, totalMarks: 50, status: 'graded'  },
    { studentId: 'STU-004', name: 'Priya Gupta',  rollNo: '11A-002', marksObtained: 29, totalMarks: 50, status: 'graded'  },
    { studentId: 'STU-005', name: 'Amit Singh',   rollNo: '11A-005', marksObtained: 0,  totalMarks: 50, status: 'pending' },
    { studentId: 'STU-006', name: 'Ravi Kumar',   rollNo: '11A-003', marksObtained: 0,  totalMarks: 50, status: 'pending' },
  ],
};

// ─── Assignments ──────────────────────────────────────────────────────────────
// Table: assignments  FK: batchId, subjectId, teacherId
export const assignments = [
  { id: 'A1', batchId: '11A', title: 'Rotational Motion – NCERT Q1-Q15',  dueDate: '8 May 2025',  totalStudents: 48, submitted: 35, status: 'active'    },
  { id: 'A2', batchId: '11A', title: 'Work-Energy Theorem Problems',       dueDate: '7 May 2025',  totalStudents: 48, submitted: 48, status: 'completed' },
  { id: 'A3', batchId: '11A', title: 'Thermodynamics – Practice Sheet',    dueDate: '10 May 2025', totalStudents: 48, submitted: 20, status: 'active'    },
  { id: 'A4', batchId: '11A', title: 'JEE Mechanics Revision Set',         dueDate: '15 May 2025', totalStudents: 48, submitted: 0,  status: 'draft'     },
];

// ─── Weak Topics (per batch, computed from test results) ─────────────────────
// Computed: analytics engine, stored in: batch_weak_topics
export const batchWeakTopics = {
  '11A': [
    { topic: 'Rotational Motion', weakCount: 18, totalStudents: 48, avgScore: 41 },
    { topic: 'Thermodynamics',    weakCount: 11, totalStudents: 48, avgScore: 52 },
    { topic: 'Work-Energy',       weakCount:  6, totalStudents: 48, avgScore: 61 },
  ],
};

// ─── Weak students per topic ──────────────────────────────────────────────────
export const topicWeakStudents = {
  'Rotational Motion': [
    { studentId: 'STU-006', name: 'Ravi Kumar',  batchId: '11A', avgInTopic: 38 },
    { studentId: 'STU-005', name: 'Amit Singh',  batchId: '11A', avgInTopic: 45 },
  ],
};

// ─── Extra Classes ────────────────────────────────────────────────────────────
// Table: extra_classes  FK: batchId, subjectId, topicId
export const extraClasses = [
  { id: 'EC1', batchId: '11A', topic: 'Rotational Motion Basics',    date: '8 May 2025',  time: '04:00 PM', room: 'Room 201', enrolled: 18, capacity: 20, status: 'upcoming'  },
  { id: 'EC2', batchId: '11A', topic: 'Thermodynamics – Carnot',      date: '9 May 2025',  time: '03:00 PM', room: 'Room 202', enrolled: 10, capacity: 12, status: 'upcoming'  },
  { id: 'EC3', batchId: '11A', topic: 'Work-Energy Theorem Revision', date: '5 May 2025',  time: '04:00 PM', room: 'Room 201', enrolled: 15, capacity: 15, status: 'completed' },
];

// ─── Today's Schedule ─────────────────────────────────────────────────────────
// Table: schedule  FK: batchId, teacherId
export const todaySchedule = [
  { id: 'S1', time: '09:00 AM', batchId: '11A', topic: 'Rotational Motion – Ch 7', room: 'Room 201', type: 'class',     status: 'ongoing'  },
  { id: 'S2', time: '10:00 AM', batchId: '11B', topic: 'Work, Power & Energy',      room: 'Room 202', type: 'class',     status: 'upcoming' },
  { id: 'S3', time: '11:00 AM', batchId: '12A', topic: 'Optics – Ray Optics Lab',   room: 'Lab 1',    type: 'practical', status: 'upcoming' },
  { id: 'S4', time: '02:00 PM', batchId: '11A', topic: 'Extra Class – Weak Students',room: 'Room 201', type: 'extra',    status: 'upcoming' },
];

// ─── AI Briefings (per batch, server-computed) ────────────────────────────────
// In production: generated by AI engine, cached per batch
export const aiBriefings = {
  '11A': {
    severity:  'warning' as const,
    headline:  '18 students are weak in Rotational Motion.',
    reasoning: 'Based on last 3 tests, Q1 & Q2 (Torque, Angular Momentum) had <42% correct rate.',
    actions: [
      { label: 'Schedule Extra Class', type: 'extra-class', topicHint: 'Rotational Motion' },
      { label: 'Assign Practice Set',  type: 'assignment',  topicHint: 'Rotational Motion' },
      { label: 'Re-test in 7 days',    type: 'schedule-test' },
    ],
  },
  '11B': {
    severity:  'critical' as const,
    headline:  'Batch average dropped 5% from last month.',
    reasoning: 'Thermodynamics chapter test avg was 52%. 12 students below 50%.',
    actions: [
      { label: 'Schedule Revision Class', type: 'extra-class', topicHint: 'Thermodynamics' },
      { label: 'Send Practice Sheet',     type: 'assignment' },
    ],
  },
  '12A': {
    severity:  'good' as const,
    headline:  'This batch is performing well.',
    reasoning: 'Average score 79%, trending up. Top score 98% in last mock test.',
    actions: [
      { label: 'Schedule next mock test', type: 'schedule-test' },
    ],
  },
};

// ─── Today's Urgent Actions (server-computed AI conclusions) ──────────────────
export const urgentActions = [
  { id: 'UA1', severity: 'high',   batchId: '11A', message: '18 students weak in Rotational Motion in 11A', actions: ['Schedule Extra Class', 'Assign Practice Set'] },
  { id: 'UA2', severity: 'high',   batchId: '11A', message: '39 ungraded copies — JEE Mock 07 (11A)',        actions: ['Start Grading'] },
  { id: 'UA3', severity: 'medium', batchId: null,  message: '5 doubts unanswered for 3+ days',               actions: ['View Doubts'] },
];

// ─── Weekly Timetable ─────────────────────────────────────────────────────────
export const weeklyTimetable = {
  Mon: [
    { time: '09:00–10:00', batchId: '11A', topic: 'Rotational Motion – Ch 7',    room: 'Room 201', type: 'class'     },
    { time: '10:00–11:00', batchId: '11B', topic: 'Work, Power & Energy',          room: 'Room 202', type: 'class'     },
    { time: '11:00–12:00', batchId: '12A', topic: 'Optics – Ray Optics',           room: 'Lab 1',    type: 'practical' },
    { time: '02:00–03:00', batchId: '12B', topic: 'Electrostatics – Ch 1',         room: 'Room 203', type: 'class'     },
  ],
  Tue: [
    { time: '09:00–10:00', batchId: '11C', topic: 'Kinematics – Projectile',       room: 'Room 201', type: 'class'     },
    { time: '10:00–11:00', batchId: '12A', topic: 'Modern Physics – Duality',      room: 'Room 202', type: 'class'     },
    { time: '02:00–03:00', batchId: '11A', topic: 'Doubt Clearing Session',        room: 'Room 201', type: 'extra'     },
  ],
  Wed: [
    { time: '09:00–10:00', batchId: '11A', topic: 'Rotational Motion – Numericals',room: 'Room 201', type: 'class'     },
    { time: '10:00–11:00', batchId: '11B', topic: 'Thermodynamics – Laws',          room: 'Room 202', type: 'class'     },
    { time: '11:00–12:00', batchId: '12B', topic: 'Physics Practical – Circuits',   room: 'Lab 1',    type: 'practical' },
  ],
  Thu: [
    { time: '09:00–10:00', batchId: '12A', topic: 'Semiconductor Devices',         room: 'Room 202', type: 'class'     },
    { time: '10:00–11:00', batchId: '11C', topic: 'Laws of Motion – Ch 5',         room: 'Room 201', type: 'class'     },
    { time: '02:00–03:00', batchId: '11A', topic: 'Remedial – Rotational Motion',  room: 'Room 201', type: 'extra'     },
  ],
  Fri: [
    { time: '09:00–10:00', batchId: '11A', topic: 'Unit Test – Rotational Motion', room: 'Room 201', type: 'test'      },
    { time: '10:00–11:00', batchId: '12A', topic: 'JEE Mock Practice Session',     room: 'Room 202', type: 'class'     },
  ],
  Sat: [
    { time: '09:00–11:00', batchId: '12A', topic: 'Full Syllabus Mock Test',       room: 'Exam Hall', type: 'test'     },
  ],
};

// ─── Doubts ───────────────────────────────────────────────────────────────────
// Table: doubts  FK: studentId, batchId, subjectId
export const doubts = [
  { id: 'D1', studentId: 'STU-002', studentName: 'Aryan Sharma',  batchId: '11A', topic: 'Rotational Motion', question: 'How do we determine the direction of torque for a rotating body when multiple forces act simultaneously?', askedAt: '2 May 2025, 9:15 AM', status: 'pending',  priority: 'high'   },
  { id: 'D2', studentId: 'STU-004', studentName: 'Priya Gupta',   batchId: '11A', topic: 'Thermodynamics',    question: 'Can you explain why efficiency of a Carnot engine depends only on temperatures?', askedAt: '1 May 2025, 7:30 PM', status: 'resolved', priority: 'medium' },
  { id: 'D3', studentId: 'STU-006', studentName: 'Ravi Kumar',    batchId: '11A', topic: 'Electrostatics',    question: 'In a non-uniform electric field, is the work done by the electric force path-independent?', askedAt: '30 Apr 2025, 8:00 PM', status: 'pending',  priority: 'medium' },
];

// ─── Papers ────────────────────────────────────────────────────────────────────
// Table: papers  FK: teacherId, subjectId
export const papers = [
  { id: 'P1', batchIds: ['11A','11B','11C'], name: 'JEE Main Mock Test 08',         classId: '11', subjectId: 'physics', marks: 50, questions: 25, difficulty: 'hard',   status: 'published', date: '2 May 2025',  scheduledFor: '10 May 2025' },
  { id: 'P2', batchIds: ['11A','11B'],       name: 'Unit Test – Work, Power, Energy',classId: '11', subjectId: 'physics', marks: 30, questions: 15, difficulty: 'medium', status: 'draft',     date: '28 Apr 2025', scheduledFor: null },
  { id: 'P3', batchIds: ['12A','12B'],       name: 'Chapter Test – Thermodynamics',  classId: '12', subjectId: 'physics', marks: 20, questions: 10, difficulty: 'medium', status: 'scheduled', date: '25 Apr 2025', scheduledFor: '15 May 2025' },
];

// ─── Question Bank ────────────────────────────────────────────────────────────
// Table: questions  FK: subjectId, chapterId, topicId
export const questions = [
  { id: 'Q001', subjectId: 'physics', chapter: 'Rotational Motion',   topic: 'Torque',             difficulty: 'hard',   type: 'mcq',       marks: 4, usedCount: 12, source: 'JEE 2023' },
  { id: 'Q002', subjectId: 'physics', chapter: 'Rotational Motion',   topic: 'Moment of Inertia',  difficulty: 'medium', type: 'mcq',       marks: 4, usedCount: 8,  source: 'Custom'   },
  { id: 'Q003', subjectId: 'physics', chapter: 'Work, Power, Energy', topic: 'Work-Energy Theorem',difficulty: 'easy',   type: 'numerical', marks: 4, usedCount: 15, source: 'NCERT'    },
  { id: 'Q004', subjectId: 'physics', chapter: 'Thermodynamics',      topic: 'Carnot Engine',      difficulty: 'hard',   type: 'mcq',       marks: 4, usedCount: 6,  source: 'JEE 2022' },
  { id: 'Q005', subjectId: 'physics', chapter: 'Modern Physics',      topic: 'Photoelectric',      difficulty: 'medium', type: 'mcq',       marks: 4, usedCount: 10, source: 'NEET 2023'},
];

// ─── Reports (generated) ──────────────────────────────────────────────────────
export const generatedReports = [
  { id: 'GR1', name: 'Batch Performance – April 2025', type: 'batch',   batchId: '11A', generatedOn: '1 May 2025',  sizeMb: 1.2 },
  { id: 'GR2', name: 'Test Analysis – Mock Test 07',   type: 'test',    testId: 'T1',   generatedOn: '5 May 2025',  sizeMb: 0.87 },
  { id: 'GR3', name: 'Student Progress – 11A Q1',      type: 'student', batchId: '11A', generatedOn: '2 Apr 2025',  sizeMb: 2.1  },
];

// ─── Helper selectors (used by components) ───────────────────────────────────
export function getBatchesByClassSubject(classId: string, subjectId: string) {
  return batches.filter(b => b.classId === classId && b.subjectId === subjectId);
}

export function getStudentsByBatch(batchId: string) {
  return students.filter(s => s.batchId === batchId);
}

export function getTestsByBatch(batchId: string) {
  return tests.filter(t => t.batchId === batchId);
}

export function getAssignmentsByBatch(batchId: string) {
  return assignments.filter(a => a.batchId === batchId);
}

export function getExtraClassesByBatch(batchId: string) {
  return extraClasses.filter(ec => ec.batchId === batchId);
}

export function getDoubtsByBatch(batchId: string) {
  return doubts.filter(d => d.batchId === batchId);
}

export function getQuestionsByChapter(subjectId: string, chapter?: string) {
  return questions.filter(q =>
    q.subjectId === subjectId && (!chapter || q.chapter === chapter)
  );
}

export function getPapersByClass(classId: string) {
  return papers.filter(p => p.classId === classId);
}

export function getBatchById(id: string) {
  return batches.find(b => b.id === id);
}

export function getStudentById(id: string) {
  return students.find(s => s.id === id);
}

export function getTestById(id: string) {
  return tests.find(t => t.id === id);
}

// ─── Nav items for teacher sidebar (7 items only) ─────────────────────────────
export const teacherNavItems = [
  'today',
  'classes',
  'paper-builder',
  'question-bank',
  'doubt-center',
  'reports',
  'settings',
] as const;
