import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeacherAttendance } from './TeacherAttendance';

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1', role: 'TEACHER', name: 'Maths Teacher', instituteId: 'inst-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/DatePicker', () => ({
  DatePicker: () => <div data-testid="mock-datepicker" />,
}));

const mockTodayData = {
  date: '2026-10-09',
  timezone: 'Asia/Kolkata',
  sessions: [
    {
      id: 'sess-1',
      snapshotBatchName: 'Class 10-A',
      snapshotSubjectName: 'Mathematics',
      snapshotTeacherName: 'Maths Teacher',
      derivedState: 'OPEN',
      canOperate: true,
      rosterCount: 2,
      recordsCount: 0,
      version: 1,
      snapshotStartTime: '2026-10-09T09:00:00Z',
      snapshotEndTime: '2026-10-09T10:00:00Z',
    },
  ],
  meta: { total: 1, openCount: 1, finalizedCount: 0, awaitingCount: 0 },
};

const mockSessionDetails = {
  session: {
    id: 'sess-1',
    snapshotBatchName: 'Class 10-A',
    snapshotSubjectName: 'Mathematics',
    version: 1,
    finalizedAt: null,
  },
  authority: {
    canOperate: true,
    canCorrect: false,
  },
  students: [
    { studentProfileId: 'st-1', name: 'Alice Kumar', rollNumber: '01', status: null },
    { studentProfileId: 'st-2', name: 'Bob Singh', rollNumber: '02', status: null },
  ],
};

const mockSaveDraft = vi.fn().mockResolvedValue({ version: 2 });
const mockFinalize = vi.fn().mockResolvedValue({ success: true });

vi.mock('@/hooks/useApi', () => ({
  useTodayAttendanceSessions: () => ({
    data: mockTodayData,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useAttendanceSessionDetails: (sessionId: string | null) => ({
    data: sessionId ? mockSessionDetails : null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useSaveAttendanceDraft: () => ({
    mutateAsync: mockSaveDraft,
    isPending: false,
  }),
  useFinalizeAttendance: () => ({
    mutateAsync: mockFinalize,
    isPending: false,
  }),
}));

describe('TeacherAttendance render test', () => {
  it('renders daily schedule and session cards', () => {
    render(<TeacherAttendance />);
    expect(screen.getByText(/Today's Attendance/i)).toBeInTheDocument();
    expect(screen.getByText(/Class 10-A/i)).toBeInTheDocument();
    expect(screen.getByText(/Mathematics/i)).toBeInTheDocument();
  });

  it('navigates to session marking view when Take Attendance is clicked', () => {
    render(<TeacherAttendance />);
    const takeAttendanceBtn = screen.getByRole('button', { name: /take attendance/i });
    expect(takeAttendanceBtn).toBeInTheDocument();
    fireEvent.click(takeAttendanceBtn);

    expect(screen.getByText(/Alice Kumar/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Singh/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark all present/i })).toBeInTheDocument();
  });
});
