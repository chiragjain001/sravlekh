// ─── Settings Module: Mock Dataset ──────────────────────────────────────────

import type { SystemSettings } from '../types/settings.types';

export const MOCK_SYSTEM_SETTINGS: SystemSettings = {
  profile: {
    name:         'AIOS Institute of Advanced Education',
    code:         'AIOS-001',
    address:      '123 Education Street, Sector 15, Jaipur, Rajasthan - 302015',
    phone:        '+91 98765 43210',
    supportEmail: 'admin@aios.edu.in',
  },
  academic: {
    activeYear:                '2024 - 2025 (Current Active)',
    minAttendance:             75,
    sendSMSOnAbsence:          true,
    negativeMarkingOnTests:    true,
    allowStudentSelfAttendance: false,
  },
  notifications: [
    {
      id:      'notif-1',
      title:   'Daily Attendance Summary',
      desc:    'Send daily summary report of present/absent status to parents',
      channel: 'SMS & App',
      enabled: true,
    },
    {
      id:      'notif-2',
      title:   'Exam Scorecard & Result Declaration',
      desc:    'Dispatch detailed PDF scorecard when teacher publishes test results',
      channel: 'Email & App',
      enabled: true,
    },
    {
      id:      'notif-3',
      title:   'Fee Due & Payment Receipts',
      desc:    'Send fee reminder notices and instant payment confirmation receipts',
      channel: 'WhatsApp & SMS',
      enabled: true,
    },
    {
      id:      'notif-4',
      title:   'Class Timetable & Teacher Substitution Notice',
      desc:    'Notify students about emergency class room or teacher swaps',
      channel: 'App Push',
      enabled: true,
    },
  ],
  security: {
    adminEmail:            'admin@aios.edu.in',
    sessionTimeoutMinutes: 30,
  },
};
