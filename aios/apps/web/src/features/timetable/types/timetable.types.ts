// ─── Timetable Feature: Types ──────────────────────────────────────────────────

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface ClassSessionItem {
  id:          string;
  timeSlot:    string;          // e.g. '08:00 - 09:00 AM'
  day:         DayOfWeek;
  subject:     string;          // e.g. 'Physics'
  batch:       string;          // e.g. 'JEE 2025 Star'
  room:        string;          // e.g. 'B-101'
  facultyName: string;          // e.g. 'Dr. Ramesh Kumar'
  color:       string;          // e.g. 'bg-blue-50 border-blue-200 text-blue-800'
  status:      'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'substituted';
}

export interface DayHeaderItem {
  day:    string;               // e.g. '19 May'
  name:   DayOfWeek;
  active?: boolean;
}

export interface TimetableGridRow {
  time: string;                 // e.g. '08:00 - 09:00 AM'
  mon:  ClassSessionItem | null;
  tue:  ClassSessionItem | null;
  wed:  ClassSessionItem | null;
  thu:  ClassSessionItem | null;
  fri:  ClassSessionItem | null;
  sat:  ClassSessionItem | null;
  sun:  ClassSessionItem | null;
}

export interface UpcomingSubstitutionItem {
  id:          string;
  subject:     string;
  teacherName: string;
  time:        string;
  batch:       string;
}

export interface ScheduleAlertItem {
  id:       string;
  type:     string;
  title:    string;
  severity: 'high' | 'medium' | 'low';
}

export interface TeacherAvailabilityItem {
  day: string;
  rate: number;
}

export interface SubjectDistributionItem {
  name:    string;
  value:   number;
  color:   string;
  percent: string;
}

export interface RoomUtilizationItem {
  name:  string;
  value: number;
  color: string;
}

export interface TimetableAnalytics {
  totalBatches:        number;
  totalClassesPerWeek: number;
  totalSubjects:       number;
  freeRoomsCount:      number;
  substitutionsToday:  number;

  todaysHighlights: {
    totalClasses:  number;
    completed:     number;
    remaining:     number;
    substitutions: number;
  };

  teacherAvailability:   TeacherAvailabilityItem[];
  subjectDistribution:   SubjectDistributionItem[];
  roomUtilization:       RoomUtilizationItem[];
  upcomingSubstitutions: UpcomingSubstitutionItem[];
  scheduleAlerts:        ScheduleAlertItem[];
}

export interface GetTimetableParams {
  batch?:   string;
  subject?: string;
  teacher?: string;
  room?:    string;
  day?:     DayOfWeek;
  search?:  string;
}

export interface CreateSessionInput {
  timeSlot:    string;
  day:         DayOfWeek;
  subject:     string;
  batch:       string;
  room:        string;
  facultyName: string;
}

export interface UpdateSessionInput extends Partial<CreateSessionInput> {
  id:      string;
  status?: ClassSessionItem['status'];
}
