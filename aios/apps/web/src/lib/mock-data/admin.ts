export const adminData = {
  user: {
    name: 'Neha Malhotra',
    designation: 'Institute Admin',
    role: 'Admin' as const,
    today: 'Today, 23 May 2025',
    avatarInitials: 'NM',
  },

  kpis: [
    { label: 'Total Students',   value: '1,284', change: '+8%',  color: 'indigo'  },
    { label: 'Total Teachers',   value: '96',    change: '+4%',  color: 'emerald' },
    { label: 'Active Batches',   value: '48',    change: '+6%',  color: 'sky'     },
    { label: 'Tests This Month', value: '24',    change: '+12%', color: 'violet'  },
  ],

  performanceData: [
    { month: 'Jan', avgScore: 72, attendance: 85 },
    { month: 'Feb', avgScore: 74, attendance: 88 },
    { month: 'Mar', avgScore: 70, attendance: 82 },
    { month: 'Apr', avgScore: 76, attendance: 90 },
    { month: 'May', avgScore: 78, attendance: 87 },
    { month: 'Jun', avgScore: 80, attendance: 92 },
  ],

  topBatches: [
    { name: 'JEE 2025 Star Batch',    score: 91 },
    { name: 'NEET 2025 Target Batch', score: 88 },
    { name: 'Foundation 11A',         score: 84 },
    { name: 'JEE 2026 Early Batch',   score: 82 },
  ],

  alerts: [
    { text: '5 teachers have evaluation pending',             type: 'warning' },
    { text: '12 students have < 60% attendance',             type: 'error'   },
    { text: '3 remedial classes scheduled today',            type: 'info'    },
    { text: 'Fee reminder for 56 students',                  type: 'warning' },
  ],

  recentActivities: [
    { event: 'JEE Main Mock Test 07 published',         time: '10:30 AM', icon: 'file-text'  },
    { event: 'Timetable updated by Rahul Verma',        time: '09:15 AM', icon: 'calendar'   },
    { event: 'New student admission - Ayush Singh',     time: '11:45 AM', icon: 'user-plus'  },
    { event: 'Fee collection of ₹1,24,500',             time: '12:30 PM', icon: 'indian-rupee' },
  ],

  attendance: {
    present: 92,
    absent: 6,
    leave: 2,
    average: '92%',
  },

  feeCollection: {
    collected:  '₹24,80,000',
    expected:   '₹28,50,000',
    percentage: 87,
  },

  navItems: [
    'Dashboard', 'Students', 'Teachers', 'Batches', 'Academics', 'Question Bank',
    'Papers', 'Assignments', 'Exams', 'Doubts', 'Timetable', 'Attendance', 'Communication',
    'Reports', 'Analytics', 'System Settings', 'Audit Logs', 'Evaluation Quality',
  ],
};
