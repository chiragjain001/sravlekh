// ─── Timetable Module: Mock Data Layer ──────────────────────────────────────────

import type {
  ClassSessionItem,
  DayHeaderItem,
  TimetableGridRow,
  TimetableAnalytics,
} from '../types/timetable.types';

export const DAYS_HEADER: DayHeaderItem[] = [
  { day: '19 May', name: 'Mon' },
  { day: '20 May', name: 'Tue' },
  { day: '21 May', name: 'Wed', active: true },
  { day: '22 May', name: 'Thu' },
  { day: '23 May', name: 'Fri' },
  { day: '24 May', name: 'Sat' },
  { day: '25 May', name: 'Sun' },
];

export const MOCK_TIMETABLE_GRID: TimetableGridRow[] = [
  {
    time: '08:00 - 09:00 AM',
    mon: { id: 's-1', timeSlot: '08:00 - 09:00 AM', day: 'Mon', subject: 'Physics',     batch: 'JEE 2025 Star',    room: 'B-101', facultyName: 'Rahul Verma',    color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'completed' },
    tue: null,
    wed: null,
    thu: { id: 's-2', timeSlot: '08:00 - 09:00 AM', day: 'Thu', subject: 'Mathematics', batch: 'JEE 2025 Star',    room: 'B-102', facultyName: 'Amitabh Sen',    color: 'bg-emerald-50 border-emerald-200 text-emerald-800', status: 'scheduled' },
    fri: null, sat: null, sun: null,
  },
  {
    time: '09:00 - 10:00 AM',
    mon: { id: 's-3', timeSlot: '09:00 - 10:00 AM', day: 'Mon', subject: 'Chemistry',   batch: 'NEET 2025 Target', room: 'A-102', facultyName: 'Pooja Sharma',   color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'completed' },
    tue: null,
    wed: { id: 's-4', timeSlot: '09:00 - 10:00 AM', day: 'Wed', subject: 'Physics',     batch: 'JEE 2025 Star',    room: 'B-101', facultyName: 'Rahul Verma',    color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'in_progress' },
    thu: { id: 's-5', timeSlot: '09:00 - 10:00 AM', day: 'Thu', subject: 'Chemistry',   batch: 'NEET 2025 Target', room: 'B-102', facultyName: 'Pooja Sharma',   color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'scheduled' },
    fri: null, sat: null, sun: null,
  },
  {
    time: '10:15 - 11:15 AM',
    mon: { id: 's-6', timeSlot: '10:15 - 11:15 AM', day: 'Mon', subject: 'Biology',     batch: 'NEET 2025 Target', room: 'B-201', facultyName: 'Priya Sharma',   color: 'bg-purple-50 border-purple-200 text-purple-800', status: 'completed' },
    tue: null,
    wed: { id: 's-7', timeSlot: '10:15 - 11:15 AM', day: 'Wed', subject: 'Chemistry',   batch: 'Foundation 11A',   room: 'B-102', facultyName: 'Pooja Sharma',   color: 'bg-rose-50 border-rose-200 text-rose-800', status: 'scheduled' },
    thu: { id: 's-8', timeSlot: '10:15 - 11:15 AM', day: 'Thu', subject: 'Chemistry',   batch: 'Foundation 11A',   room: 'B-102', facultyName: 'Pooja Sharma',   color: 'bg-amber-50 border-amber-200 text-amber-800', status: 'scheduled' },
    fri: null, sat: null, sun: null,
  },
  {
    time: '11:15 - 12:15 PM',
    mon: { id: 's-9', timeSlot: '11:15 - 12:15 PM', day: 'Mon', subject: 'Biology',     batch: 'NEET 2025 Target', room: 'B-201', facultyName: 'Priya Sharma',   color: 'bg-purple-50 border-purple-200 text-purple-800', status: 'completed' },
    tue: null,
    wed: { id: 's-10',timeSlot: '11:15 - 12:15 PM', day: 'Wed', subject: 'English',     batch: 'Foundation 11A',   room: 'B-104', facultyName: 'Neha Gupta',     color: 'bg-rose-50 border-rose-200 text-rose-800', status: 'scheduled' },
    thu: { id: 's-11',timeSlot: '11:15 - 12:15 PM', day: 'Thu', subject: 'Physics',     batch: 'Foundation 11B',   room: 'B-104', facultyName: 'Rahul Verma',    color: 'bg-amber-50 border-amber-200 text-amber-800', status: 'scheduled' },
    fri: null, sat: null, sun: null,
  },
  {
    time: '01:15 - 02:15 PM',
    mon: { id: 's-12',timeSlot: '01:15 - 02:15 PM', day: 'Mon', subject: 'Physical Educ.', batch: 'Foundation 11B', room: 'B-103', facultyName: 'Vikram Singh', color: 'bg-emerald-50 border-emerald-200 text-emerald-800', status: 'scheduled' },
    tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
  },
  {
    time: '02:15 - 03:15 PM',
    mon: null, tue: null,
    wed: { id: 's-13',timeSlot: '02:15 - 03:15 PM', day: 'Wed', subject: 'Maths',       batch: 'Foundation 11B',   room: 'B-104', facultyName: 'Amit Singh',     color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'scheduled' },
    thu: { id: 's-14',timeSlot: '02:15 - 03:15 PM', day: 'Thu', subject: 'Physical Educ.', batch: 'Foundation 11B', room: 'Ground',facultyName: 'Vikram Singh', color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'scheduled' },
    fri: null, sat: null, sun: null,
  },
  {
    time: '03:30 - 04:30 PM',
    mon: { id: 's-15',timeSlot: '03:30 - 04:30 PM', day: 'Mon', subject: 'English',     batch: 'Foundation 11B',   room: 'B-104', facultyName: 'Neha Gupta',     color: 'bg-blue-50 border-blue-200 text-blue-800', status: 'scheduled' },
    tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
  },
];

export const MOCK_TIMETABLE_ANALYTICS: TimetableAnalytics = {
  totalBatches:        48,
  totalClassesPerWeek: 612,
  totalSubjects:       36,
  freeRoomsCount:      12,
  substitutionsToday:  4,

  todaysHighlights: {
    totalClasses:  82,
    completed:     46,
    remaining:     36,
    substitutions: 2,
  },

  teacherAvailability: [
    { day: 'Mon', rate: 92 },
    { day: 'Tue', rate: 80 },
    { day: 'Wed', rate: 85 },
    { day: 'Thu', rate: 80 },
    { day: 'Fri', rate: 78 },
  ],

  subjectDistribution: [
    { name: 'Physics',     value: 156, color: '#3b82f6', percent: '25%' },
    { name: 'Chemistry',   value: 144, color: '#10b981', percent: '24%' },
    { name: 'Mathematics', value: 168, color: '#f59e0b', percent: '27%' },
    { name: 'Biology',     value: 72,  color: '#a855f7', percent: '12%' },
    { name: 'Others',      value: 72,  color: '#ec4899', percent: '12%' },
  ],

  roomUtilization: [
    { name: 'Utilized',    value: 78, color: '#2563eb' },
    { name: 'Free',        value: 12, color: '#f59e0b' },
    { name: 'Maintenance', value: 10, color: '#9333ea' },
  ],

  upcomingSubstitutions: [
    { id: 'sub-1', subject: 'Physics',   teacherName: 'Rahul Verma',  time: '08:30 AM', batch: 'JEE 2025 Star' },
    { id: 'sub-2', subject: 'Chemistry', teacherName: 'Pooja Sharma', time: '11:15 AM', batch: 'Foundation 11A' },
    { id: 'sub-3', subject: 'Maths',     teacherName: 'Amit Singh',   time: '01:15 PM', batch: 'Foundation 11B' },
    { id: 'sub-4', subject: 'English',   teacherName: 'Neha Gupta',   time: '03:30 PM', batch: 'JEE 2026 Early' },
  ],

  scheduleAlerts: [
    { id: 'alt-1', type: 'error',  title: '4 rooms double booked', severity: 'high' },
    { id: 'alt-2', type: 'warning',title: '6 classes without teacher', severity: 'medium' },
    { id: 'alt-3', type: 'warning',title: '2 batches missing break', severity: 'low' },
  ],
};
