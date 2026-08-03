export const founderData = {
  user: {
    name: 'Super Admin',
    designation: 'Platform Owner',
    role: 'Founder' as const,
    avatarInitials: 'SA',
    selectedMonth: 'May 2025',
    selectedInstitute: 'All Institutes',
  },

  kpis: [
    { label: 'Total Institutes',  value: '128',        change: '+14%', color: 'indigo'  },
    { label: 'Total Users',       value: '45,689',     change: '+18%', color: 'sky'     },
    { label: 'Active Students',   value: '38,542',     change: '+17%', color: 'emerald' },
    { label: 'Monthly Revenue',   value: '₹48,75,000', change: '+21%', color: 'violet'  },
  ],

  platformUsage: [
    { month: 'Jan', students: 32000, teachers: 2800, exams: 1200 },
    { month: 'Feb', students: 34000, teachers: 3000, exams: 1400 },
    { month: 'Mar', students: 36000, teachers: 3100, exams: 1600 },
    { month: 'Apr', students: 37000, teachers: 3200, exams: 1500 },
    { month: 'May', students: 38542, teachers: 3400, exams: 1800 },
  ],

  topInstitutes: [
    { name: 'Aakash Kota',       score: 92, rank: 1 },
    { name: 'Resonance Delhi',   score: 89, rank: 2 },
    { name: 'FIITJEE Noida',     score: 87, rank: 3 },
    { name: 'Allen Jaipur',      score: 85, rank: 4 },
  ],

  systemHealth: {
    status: 'All Systems Operational',
    serverUptime:    '99.98%',
    responseTime:    '320ms',
    activeBackups:   '100%',
  },

  recentRegistrations: [
    { name: 'New Institute – Sigma Classes', time: '11:30 AM', type: 'Institute' },
    { name: 'New Institute – Bright Future', time: '10:45 AM', type: 'Institute' },
    { name: 'New Teacher – Ankit Sharma',    time: '09:30 AM', type: 'Teacher'   },
    { name: 'New Student – Riya Kumari',     time: '09:10 AM', type: 'Student'   },
  ],

  revenueData: [
    { month: 'Jan', revenue: 38 },
    { month: 'Feb', revenue: 41 },
    { month: 'Mar', revenue: 39 },
    { month: 'Apr', revenue: 44 },
    { month: 'May', revenue: 48.75 },
  ],

  supportTickets: {
    open:       32,
    inProgress: 54,
    resolved:   70,
    total:      156,
  },

  navItems: [
    'Overview', 'Institutes', 'Users', 'Analytics', 'Subscriptions',
    'System Health', 'Audit Logs', 'Support Tickets', 'Settings',
    'Feature Management', 'Integrations',
  ],
};
