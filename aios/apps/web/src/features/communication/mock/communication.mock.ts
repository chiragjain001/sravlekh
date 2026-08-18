// ─── Communication Module: Mock Dataset ──────────────────────────────────────

import type {
  AnnouncementItem,
  CommunicationAnalytics,
} from '../types/communication.types';

export const MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id:             'ann-1',
    title:          'Summer Camp 2025 Registration Open',
    content:        'Registration for our annual summer academic camp is officially open. Early bird discount applies until May 30.',
    targetAudience: 'All Students',
    publishDate:    '23 May 2025, 08:30 AM',
    channels:       ['App Push', 'SMS', 'WhatsApp'],
    readCount:      1840,
    totalTarget:    2480,
    readRate:       74,
    status:         'Published',
    author:         'Admin Team',
  },
  {
    id:             'ann-2',
    title:          'JEE Main Mock Test 08 Schedule Released',
    content:        'Mock Test 08 will be conducted on May 28 across all branches. Admit cards available on the student portal.',
    targetAudience: 'JEE 2025 & 2026 Batches',
    publishDate:    '22 May 2025, 05:15 PM',
    channels:       ['App Push', 'Email'],
    readCount:      920,
    totalTarget:    1120,
    readRate:       82,
    status:         'Published',
    author:         'Exam Dept',
  },
  {
    id:             'ann-3',
    title:          'Parent-Teacher Meeting (PTM) Notice',
    content:        'Parent-Teacher Meeting for Term 1 performance evaluation is scheduled for Sunday, May 26.',
    targetAudience: 'All Parents',
    publishDate:    '21 May 2025, 11:00 AM',
    channels:       ['App Push', 'SMS', 'WhatsApp', 'Email'],
    readCount:      2150,
    totalTarget:    2480,
    readRate:       86,
    status:         'Published',
    author:         'Principal Office',
  },
  {
    id:             'ann-4',
    title:          'Fee Payment Deadline Extension',
    content:        'The deadline for Q2 tuition fee payment has been extended by 5 days without late fee penalty.',
    targetAudience: 'Students with Dues',
    publishDate:    '20 May 2025, 03:45 PM',
    channels:       ['SMS', 'WhatsApp'],
    readCount:      340,
    totalTarget:    370,
    readRate:       91,
    status:         'Published',
    author:         'Accounts Dept',
  },
  {
    id:             'ann-5',
    title:          'Chemistry Extra Class Announcement',
    content:        'Special doubt resolution class for Organic Chemistry reaction mechanisms scheduled tomorrow at 04:00 PM.',
    targetAudience: 'NEET 2025 Target Batch',
    publishDate:    '19 May 2025, 09:20 AM',
    channels:       ['App Push'],
    readCount:      44,
    totalTarget:    48,
    readRate:       91,
    status:         'Published',
    author:         'Prof. Sunita Sharma',
  },
];

export const MOCK_COMMUNICATION_ANALYTICS: CommunicationAnalytics = {
  totalDispatched:       14250,
  successfullyDelivered: 13980,
  deliveryRate:          98,
  avgReadRate:           84,
  parentEngagementRate:  92,

  channelBreakdown: [
    { name: 'App Push', value: 45, color: '#3b82f6', percent: '45%' },
    { name: 'SMS Alert', value: 30, color: '#10b981', percent: '30%' },
    { name: 'WhatsApp',  value: 15, color: '#f59e0b', percent: '15%' },
    { name: 'Email',     value: 10, color: '#8b5cf6', percent: '10%' },
  ],

  recentDirectMessages: [
    { id: 'dm-1', senderName: 'Rohan Verma',  senderRole: 'Parent',  snippet: 'Inquiry regarding PTM timing slot', timeAgo: '10 min ago', isRead: false },
    { id: 'dm-2', senderName: 'Ananya Sharma',senderRole: 'Student', snippet: 'Request for Physics revision notes', timeAgo: '42 min ago', isRead: false },
    { id: 'dm-3', senderName: 'Dr. Ramesh',   senderRole: 'Faculty', snippet: 'Submitted test paper blueprint', timeAgo: '1 hr ago',  isRead: true },
  ],

  scheduledBroadcasts: [
    { id: 'sc-1', title: 'Weekly Performance Digest',   scheduledTime: 'Tomorrow, 09:00 AM', targetAudience: 'All Parents',   channels: ['Email', 'App Push'] },
    { id: 'sc-2', title: 'NEET Practice Test Reminder', scheduledTime: '25 May, 06:00 PM',   targetAudience: 'NEET Batches',  channels: ['SMS', 'WhatsApp'] },
  ],
};
