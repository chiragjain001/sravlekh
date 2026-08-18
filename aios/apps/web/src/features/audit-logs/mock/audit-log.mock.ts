// ─── Audit Logs Module: Mock Dataset ───────────────────────────────────────

import type {
  AuditLogItem,
  AuditLogsAnalytics,
} from '../types/audit-log.types';

export const MOCK_AUDIT_LOGS: AuditLogItem[] = [
  {
    id:        'log-1',
    dateTime:  '23 May 2025, 10:30 AM',
    user:      'Neha Malhotra',
    avatar:    'NM',
    avatarBg:  'bg-blue-500',
    action:    'Updated Student Profile',
    module:    'Students',
    details:   'Updated profile for Rohan Verma (Roll: AOS24001)',
    ipAddress: '192.168.1.10',
  },
  {
    id:        'log-2',
    dateTime:  '23 May 2025, 10:15 AM',
    user:      'Rahul Verma',
    avatar:    'RV',
    avatarBg:  'bg-amber-500',
    action:    'Created Batch',
    module:    'Batches',
    details:   'Created batch "JEE 2025 Star Batch"',
    ipAddress: '192.168.1.15',
  },
  {
    id:        'log-3',
    dateTime:  '23 May 2025, 09:45 AM',
    user:      'Priya Sharma',
    avatar:    'PS',
    avatarBg:  'bg-purple-500',
    action:    'Added Assignment',
    module:    'Academics',
    details:   'Added assignment "Physics Numericals - 02"',
    ipAddress: '192.168.1.18',
  },
  {
    id:        'log-4',
    dateTime:  '23 May 2025, 09:30 AM',
    user:      'Amit Singh',
    avatar:    'AS',
    avatarBg:  'bg-sky-500',
    action:    'Marked Attendance',
    module:    'Attendance',
    details:   'Marked attendance for JEE 2025 Star Batch',
    ipAddress: '192.168.1.12',
  },
  {
    id:        'log-5',
    dateTime:  '23 May 2025, 09:10 AM',
    user:      'Neha Malhotra',
    avatar:    'NM',
    avatarBg:  'bg-blue-500',
    action:    'Published Exam',
    module:    'Exams',
    details:   'Published exam "JEE Main Mock Test 08"',
    ipAddress: '192.168.1.10',
  },
  {
    id:        'log-6',
    dateTime:  '23 May 2025, 08:50 AM',
    user:      'Vikram Rao',
    avatar:    'VR',
    avatarBg:  'bg-rose-500',
    action:    'Sent Announcement',
    module:    'Communication',
    details:   'Sent announcement "Summer Camp Registration"',
    ipAddress: '192.168.1.20',
  },
  {
    id:        'log-7',
    dateTime:  '23 May 2025, 08:30 AM',
    user:      'Pooja Sharma',
    avatar:    'PS',
    avatarBg:  'bg-orange-500',
    action:    'Updated Fees',
    module:    'Finance',
    details:   'Updated fee for student Ananya Singh',
    ipAddress: '192.168.1.15',
  },
  {
    id:        'log-8',
    dateTime:  '23 May 2025, 08:15 AM',
    user:      'System Bot',
    avatar:    'SYS',
    avatarBg:  'bg-indigo-600',
    action:    'System Backup',
    module:    'System',
    details:   'Automated database backup completed successfully',
    ipAddress: '192.168.1.1',
  },
];

export const MOCK_AUDIT_ANALYTICS: AuditLogsAnalytics = {
  totalActivities:  2486,
  todaysActivities: 156,
  activeOperators:  18,
  failedAccess:     12,

  activityBreakdown: [
    { name: 'Create', value: 35, color: '#3b82f6', percent: '35%' },
    { name: 'Update', value: 28, color: '#10b981', percent: '28%' },
    { name: 'Delete', value: 15, color: '#ef4444', percent: '15%' },
    { name: 'View',   value: 12, color: '#f59e0b', percent: '12%' },
    { name: 'Others', value: 10, color: '#8b5cf6', percent: '10%' },
  ],

  moduleActivity: [
    { name: 'Students',   count: 620 },
    { name: 'Academics',  count: 480 },
    { name: 'Attendance', count: 540 },
    { name: 'Exams',      count: 320 },
    { name: 'Finance',    count: 290 },
  ],

  activeOperatorsList: [
    { name: 'Neha Malhotra', role: 'Super Admin',   count: '412 Logs', bg: 'bg-blue-500' },
    { name: 'Rahul Verma',   role: 'Academic Head', count: '320 Logs', bg: 'bg-amber-500' },
    { name: 'Priya Sharma',  role: 'Teacher',       count: '284 Logs', bg: 'bg-purple-500' },
    { name: 'Pooja Sharma',  role: 'Finance Admin', count: '190 Logs', bg: 'bg-orange-500' },
  ],

  securityAlerts: [
    { id: 'sec-1', title: 'Failed Login Attempt (IP: 192.168.1.105)', desc: 'Invalid password attempt for account admin@aios.edu.in', timestamp: '23 May, 10:14 AM', severity: 'high' },
    { id: 'sec-2', title: 'User Permission Modified', desc: 'Super Admin Neha Malhotra modified RBAC role for Rahul Verma', timestamp: '22 May, 07:30 PM', severity: 'medium' },
  ],
};
