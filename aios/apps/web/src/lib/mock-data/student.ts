// ── Student Mock Data ──────────────────────────────────────────────────────────

export const studentData = {
  user: {
    name: 'Aryan Sharma',
    class: 'Class 11 – JEE (2026)',
    role: 'Student' as const,
    streak: 7,
    avatarInitials: 'AS',
    overallScore: 78,
    scoreChange: '+12% from last month',
  },

  subjectScores: [
    { subject: 'Physics',     score: 82, color: '#6366f1' },
    { subject: 'Chemistry',   score: 76, color: '#06b6d4' },
    { subject: 'Mathematics', score: 74, color: '#8b5cf6' },
    { subject: 'Botany',      score: 81, color: '#10b981' },
  ],

  weakTopics: [
    { topic: 'Rotational Motion (Physics)',    level: 'High'   },
    { topic: 'Integrals & Applications (Mathematics)',    level: 'High'   },
    { topic: 'Chemical Bonding (Chemistry)',   level: 'High'   },
    { topic: 'Electrostatics (Physics)',       level: 'Medium' },
    { topic: 'Organic Chemistry (Chemistry)',  level: 'Medium' },
  ],

  nextTest: {
    name: 'JEE Main Mock Test 08',
    date: '25 May, 2025 — 10:00 AM',
    syllabus: 'Full Syllabus',
    daysLeft: 2,
    hoursLeft: 14,
    minsLeft: 48,
  },

  aiRecommendations: [
    {
      type:    'Practice Set',
      topic:   'Rotational Motion',
      detail:  '20 Questions',
      color:   'indigo',
      btnText: 'Start Now',
      btnColor:'bg-indigo-600 text-white hover:bg-indigo-700',
    },
    {
      type:    'Revision Sheet',
      topic:   'Integrals & Applications',
      detail:  '15 Questions',
      color:   'rose',
      btnText: 'Start Now',
      btnColor:'bg-rose-600 text-white hover:bg-rose-700',
    },
    {
      type:    'Video Lesson',
      topic:   'Chemical Bonding',
      detail:  '20 min',
      color:   'amber',
      btnText: 'Watch Now',
      btnColor:'bg-amber-500 text-white hover:bg-amber-600',
    },
  ],

  studyPlan: [
    { time: '09:00 AM', task: 'Rotational Motion Revision',           duration: '30 min',  subject: ''         },
    { time: '11:00 AM', task: 'Practice Set: Rotational Motion',      duration: '20 Questions', subject: '' },
    { time: '01:00 PM', task: 'Integrals Revision',                   duration: '30 min',  subject: ''         },
    { time: '04:00 PM', task: 'DPP: Integrals',                       duration: '20 Questions', subject: '' },
    { time: '06:00 PM', task: 'Doubt Session',                        duration: '',        subject: 'Physics'  },
  ],

  recentTests: [
    { name: 'JEE Main Mock Test 07', score: 82, date: '20 May 2025', color: 'text-emerald-600', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
    { name: 'JEE Main Mock Test 06', score: 74, date: '15 May 2025', color: 'text-emerald-600', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
    { name: 'JEE Main Unit Test 05', score: 68, date: '10 May 2025', color: 'text-rose-600', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
    { name: 'Physics Unit Test 04', score: 71, date: '05 May 2025', color: 'text-emerald-600', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
  ],

  assignments: [
    { status: 'pending', title: 'Rotational Motion - Practice Set', subject: 'Physics', detail: '20 Questions', due: '1 Day', dueColor: 'text-rose-600', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', type: 'check' },
    { status: 'pending', title: 'Integrals & Applications - Worksheet', subject: 'Mathematics', detail: '15 Questions', due: '2 Days', dueColor: 'text-amber-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-500', type: 'warning' },
    { status: 'pending', title: 'Chemical Bonding - NCERT Questions', subject: 'Chemistry', detail: '20 Questions', due: '3 Days', dueColor: 'text-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-500', type: 'clock' },
    { status: 'pending', title: 'Thermodynamics - Concept Map', subject: 'Physics', detail: 'Quick Notes', due: '4 Days', dueColor: 'text-slate-500', iconBg: 'bg-slate-100', iconColor: 'text-slate-500', type: 'text' },
    { status: 'submitted', title: 'Kinematics Worksheet', subject: 'Physics', detail: 'Submitted 2 Days Ago', due: 'Past', dueColor: 'text-slate-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', type: 'check' },
    { status: 'submitted', title: 'Atomic Structure DPP', subject: 'Chemistry', detail: 'Submitted Yesterday', due: 'Past', dueColor: 'text-slate-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500', type: 'text' },
    { status: 'completed', title: 'Basic Math for Physics', subject: 'Physics', detail: 'Graded: 10/10', due: 'Graded', dueColor: 'text-emerald-600', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', type: 'check' },
    { status: 'completed', title: 'Sets & Relations Quiz', subject: 'Mathematics', detail: 'Graded: 8/10', due: 'Graded', dueColor: 'text-emerald-600', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', type: 'check' },
  ],

  radarData: [
    { subject: 'Rotational Motion', A: 90, fullMark: 100 },
    { subject: 'Integrals', A: 80, fullMark: 100 },
    { subject: 'Chemical Bonding', A: 75, fullMark: 100 },
    { subject: 'Thermodynamics', A: 65, fullMark: 100 },
    { subject: 'Electrostatics', A: 60, fullMark: 100 },
  ],

  weakTopicsDetailed: [
    { name: 'Rotational Motion', score: 82, level: 'High', color: 'bg-rose-400', chipClass: 'bg-rose-50 text-rose-600' },
    { name: 'Integrals', score: 76, level: 'High', color: 'bg-rose-400', chipClass: 'bg-rose-50 text-rose-600' },
    { name: 'Chemical Bonding', score: 71, level: 'High', color: 'bg-rose-400', chipClass: 'bg-rose-50 text-rose-600' },
    { name: 'Thermodynamics', score: 64, level: 'Medium', color: 'bg-amber-400', chipClass: 'bg-amber-50 text-amber-600' },
    { name: 'Electrostatics', score: 58, level: 'Medium', color: 'bg-amber-400', chipClass: 'bg-amber-50 text-amber-600' },
  ],

  progressData: [
    { month: 'Jan', score: 62 },
    { month: 'Feb', score: 65 },
    { month: 'Mar', score: 70 },
    { month: 'Apr', score: 68 },
    { month: 'May', score: 74 },
    { month: 'Jun', score: 78 },
  ],

  // New Data for Doubt Center
  doubts: [
    { id: 1, subject: 'Physics', question: 'Why is net torque zero in Rotational Equilibrium?', time: 'Asked 2 hours ago', teacher: 'Mr. Rahul Verma', status: 'Answered', bookmarked: false },
    { id: 2, subject: 'Mathematics', question: 'How to integrate $\\int x e^x dx$ ?', time: 'Asked yesterday', teacher: 'Ms. Neha Singh', status: 'In Review', bookmarked: true },
    { id: 3, subject: 'Chemistry', question: 'Why does ionic bond form? Explain with example.', time: 'Asked 2 days ago', teacher: 'Mr. Amit Gupta', status: 'Answered', bookmarked: false },
    { id: 4, subject: 'Physics', question: 'Difference between Work & Power?', time: 'Asked 3 days ago', teacher: 'Mr. Rahul Verma', status: 'Pending', bookmarked: false },
  ],

  // New Data for Time Table
  timetableDays: ['Fri 23 May', 'Sat 24 May', 'Sun 25 May', 'Mon 26 May', 'Tue 27 May', 'Wed 28 May', 'Thu 29 May'],
  timetableEvents: [
    { day: 'Fri 23 May', time: '09:00 AM', subject: 'Physics', teacher: 'Rahul Sir', type: 'class', color: 'bg-indigo-50 text-indigo-700' },
    { day: 'Fri 23 May', time: '11:00 AM', subject: 'Maths', teacher: "Neha Ma'am", type: 'class', color: 'bg-blue-50 text-blue-700' },
    { day: 'Fri 23 May', time: '01:00 PM', subject: 'Lunch Break', type: 'break', color: 'bg-amber-50 text-amber-700' },
    { day: 'Fri 23 May', time: '02:00 PM', subject: 'DPP Practice', type: 'self', color: 'bg-slate-100 text-slate-700' },
    { day: 'Fri 23 May', time: '05:00 PM', subject: 'Doubt Session', type: 'doubt', color: 'bg-purple-50 text-purple-700' },
    
    { day: 'Sat 24 May', time: '09:00 AM', subject: 'Maths', teacher: "Neha Ma'am", type: 'class', color: 'bg-blue-50 text-blue-700' },
    { day: 'Sat 24 May', time: '01:00 PM', subject: 'Lunch Break', type: 'break', color: 'bg-amber-50 text-amber-700' },
    { day: 'Sat 24 May', time: '02:00 PM', subject: 'Test Analysis', type: 'test', color: 'bg-indigo-50 text-indigo-700' },
    { day: 'Sat 24 May', time: '05:00 PM', subject: 'Extra Class', teacher: 'Physics', type: 'extra', color: 'bg-emerald-50 text-emerald-700' },
    
    { day: 'Sun 25 May', time: '09:00 AM', subject: 'Chemistry', teacher: 'Amit Sir', type: 'class', color: 'bg-emerald-50 text-emerald-700' },
    { day: 'Sun 25 May', time: '11:00 AM', subject: 'Physics', teacher: 'Rahul Sir', type: 'class', color: 'bg-indigo-50 text-indigo-700' },
    { day: 'Sun 25 May', time: '01:00 PM', subject: 'Lunch Break', type: 'break', color: 'bg-amber-50 text-amber-700' },
    
    { day: 'Mon 26 May', time: '09:00 AM', subject: 'Physics', teacher: 'Rahul Sir', type: 'class', color: 'bg-indigo-50 text-indigo-700' },
    { day: 'Mon 26 May', time: '01:00 PM', subject: 'Lunch Break', type: 'break', color: 'bg-amber-50 text-amber-700' },
    { day: 'Mon 26 May', time: '02:00 PM', subject: 'DPP Practice', type: 'self', color: 'bg-slate-100 text-slate-700' },
    { day: 'Mon 26 May', time: '05:00 PM', subject: 'Doubt Session', type: 'doubt', color: 'bg-purple-50 text-purple-700' },
  ],

  // New Data for Extra Classes
  extraClasses: [
    { id: 1, status: 'upcoming', title: 'Rotational Motion - Concept Strengthening', subject: 'Physics', teacher: 'Rahul Verma Sir', date: '24 May, 2025', time: '09:00 AM - 10:00 AM', icon: 'atom' },
    { id: 2, status: 'upcoming', title: 'Integrals & Applications - Problem Solving', subject: 'Mathematics', teacher: "Neha Singh Ma'am", date: '25 May, 2025', time: '11:00 AM - 12:00 PM', icon: 'function' },
    { id: 3, status: 'upcoming', title: 'Chemical Bonding - Doubt Clearing', subject: 'Chemistry', teacher: 'Amit Gupta Sir', date: '26 May, 2025', time: '04:00 PM - 05:00 PM', icon: 'flask' },
    { id: 4, status: 'joined', title: 'Thermodynamics Quick Revision', subject: 'Physics', teacher: 'Rahul Verma Sir', date: '20 May, 2025', time: '05:00 PM - 06:00 PM', icon: 'atom' },
  ],
  extraClassStats: { joined: 12, topicsCovered: 8, totalHours: 6.5 },

  // New Data for Progress
  detailedProgress: {
    scoreTrend: [
      { test: 'Test 03', score: 58 },
      { test: 'Test 04', score: 62 },
      { test: 'Test 05', score: 68 },
      { test: 'Test 06', score: 71 },
      { test: 'Test 07', score: 74 },
      { test: 'Test 08', score: 78 },
    ],
    subjectWise: [
      { subject: 'Physics', improvement: 16, currentScore: 82, color: 'bg-indigo-600' },
      { subject: 'Chemistry', improvement: 12, currentScore: 76, color: 'bg-blue-500' },
      { subject: 'Mathematics', improvement: 13, currentScore: 74, color: 'bg-emerald-500' },
      { subject: 'Botany', improvement: 8, currentScore: 81, color: 'bg-orange-500' },
    ],
    summaryStats: {
      testsAttempted: 16,
      averageScore: 68,
      averageScoreImprovement: 14,
      highestScore: 82,
      rankImprovement: 245,
    }
  },

  // New Data for Leaderboard
  leaderboardTop3: [
    { rank: 2, name: 'Riya Singh', points: 1250, initials: 'RS', color: 'bg-slate-200' },
    { rank: 1, name: 'Aarav Mehta', points: 1320, initials: 'AM', color: 'bg-amber-100' },
    { rank: 3, name: 'Karan Verma', points: 1180, initials: 'KV', color: 'bg-orange-100' },
  ],
  leaderboardList: [
    { rank: 4, name: 'Ananya Gupta', points: 1050, initials: 'AG', trend: 'up', trendValue: 2 },
    { rank: 5, name: 'Manav Jain', points: 980, initials: 'MJ', trend: 'down', trendValue: 1 },
    { rank: 6, name: 'You', points: 950, initials: 'Y', trend: 'flat', trendValue: 0, isCurrentUser: true },
    { rank: 7, name: 'Ishita Choudhary', points: 920, initials: 'IC', trend: 'up', trendValue: 1 },
    { rank: 8, name: 'Harshit Bansal', points: 870, initials: 'HB', trend: 'down', trendValue: 2 },
    { rank: 9, name: 'Neha Agarwal', points: 810, initials: 'NA', trend: 'flat', trendValue: 0 },
    { rank: 10, name: 'Siddharth Rai', points: 760, initials: 'SR', trend: 'flat', trendValue: 0 },
  ],

  // Class Leaderboard Data
  classLeaderboardTop3: [
    { rank: 2, name: 'Priya Sharma', points: 1020, initials: 'PS', color: 'bg-slate-200' },
    { rank: 1, name: 'You', points: 1150, initials: 'Y', color: 'bg-amber-100', isCurrentUser: true },
    { rank: 3, name: 'Rahul Dev', points: 990, initials: 'RD', color: 'bg-orange-100' },
  ],
  classLeaderboardList: [
    { rank: 4, name: 'Simran Kaur', points: 850, initials: 'SK', trend: 'up', trendValue: 3 },
    { rank: 5, name: 'Arjun Das', points: 840, initials: 'AD', trend: 'flat', trendValue: 0 },
    { rank: 6, name: 'Maya Sen', points: 810, initials: 'MS', trend: 'down', trendValue: 2 },
    { rank: 7, name: 'Rohan Joshi', points: 790, initials: 'RJ', trend: 'up', trendValue: 1 },
    { rank: 8, name: 'Kavya Pillai', points: 760, initials: 'KP', trend: 'down', trendValue: 1 },
    { rank: 9, name: 'Varun Nair', points: 710, initials: 'VN', trend: 'flat', trendValue: 0 },
    { rank: 10, name: 'Sneha Reddy', points: 680, initials: 'SR', trend: 'down', trendValue: 3 },
  ],

  // New Data for Resources
  resourcesQuickAccess: [
    { title: 'Class Notes', count: '150+ Notes', icon: 'file-text', color: 'text-purple-600', bg: 'bg-purple-50', filter: 'Notes' },
    { title: 'Video Lectures', count: '120+ Videos', icon: 'play', color: 'text-rose-500', bg: 'bg-rose-50', filter: 'Videos' },
    { title: 'NCERT Books', count: 'All Subjects', icon: 'book', color: 'text-emerald-500', bg: 'bg-emerald-50', filter: 'Books' },
    { title: 'PYQs', count: '10+ Years', icon: 'file-question', color: 'text-orange-500', bg: 'bg-orange-50', filter: 'PYQs' },
    { title: 'Practice Sets', count: '500+ Sets', icon: 'clipboard-list', color: 'text-blue-500', bg: 'bg-blue-50', filter: 'Practice Sets' },
  ],
  allResources: [
    { id: 1, title: 'Rotational Motion - Complete Notes', subject: 'Physics • Class 11', type: 'PDF', category: 'Notes', date: '28 Jul 2025', action: 'download' },
    { id: 2, title: 'Integrals & Applications - Practice Set', subject: 'Mathematics • Class 12', type: 'PDF', category: 'Practice Sets', date: '27 Jul 2025', action: 'download' },
    { id: 3, title: 'Chemical Bonding - One Shot', subject: 'Chemistry • Class 11', type: 'Video', category: 'Videos', date: '27 Jul 2025', action: 'play' },
    { id: 4, title: 'JEE Main 2024 Paper Solution', subject: 'JEE • Previous Year Paper', type: 'PDF', category: 'PYQs', date: '26 Jul 2025', action: 'download' },
    { id: 5, title: 'NCERT Physics Part 1', subject: 'Physics • Class 11', type: 'Book', category: 'Books', date: '20 Jul 2025', action: 'download' },
    { id: 6, title: 'Thermodynamics Quick Revision', subject: 'Physics • Class 11', type: 'Video', category: 'Videos', date: '19 Jul 2025', action: 'play' },
    { id: 7, title: 'Coordination Compounds - Notes', subject: 'Chemistry • Class 12', type: 'PDF', category: 'Notes', date: '15 Jul 2025', action: 'download' },
    { id: 8, title: 'JEE Advanced 2023 Paper', subject: 'JEE • PYQ', type: 'PDF', category: 'PYQs', date: '10 Jul 2025', action: 'download' },
  ],
  resourcesCollections: [
    { title: 'JEE Main', subtitle: 'Complete Collection', count: '250+ Resources', color: 'bg-blue-50' },
    { title: 'Physics', subtitle: 'Formula Handbook', count: '120+ Resources', color: 'bg-indigo-50' },
    { title: 'Maths', subtitle: 'Problem Practice', count: '180+ Resources', color: 'bg-emerald-50' },
  ],

  navItems: [
    'Overview', 'My Tests', 'Assignments', 'Study Plan', 'Weak Topics',
    'Doubt Center', 'Time Table', 'Extra Classes', 'Progress', 'Leaderboard',
    'Resources', 'Settings',
  ],
};
