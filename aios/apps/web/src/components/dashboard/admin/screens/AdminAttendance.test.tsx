import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminAttendance } from './AdminAttendance';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock hooks
const mockDetectMissing = vi.fn();
const mockUpdatePolicy = vi.fn();
const mockFinalize = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useTodayAttendanceSessions: () => ({
    data: {
      date: '2026-10-09',
      timezone: 'Asia/Kolkata',
      sessions: [
        {
          id: 'sess-1',
          snapshotBatchName: 'Class 10-A',
          snapshotSubjectName: 'Mathematics',
          snapshotTeacherName: 'Dr. Sharma',
          derivedState: 'OPEN',
          rosterCount: 30,
          recordsCount: 0,
          snapshotStartTime: '2026-10-09T09:00:00Z',
          snapshotEndTime: '2026-10-09T10:00:00Z',
        },
      ],
      meta: {
        total: 1,
        openCount: 1,
        finalizedCount: 0,
        awaitingCount: 0,
        missedCount: 0,
        cancelledCount: 0,
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useAttendanceSessionDetails: () => ({
    data: null,
    isLoading: false,
  }),
  useAwaitingFinalizationSessions: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useMissingAttendanceSessions: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDetectMissingAttendance: () => ({
    mutate: mockDetectMissing,
    isPending: false,
  }),
  useFinalizeAttendance: () => ({
    mutateAsync: mockFinalize,
    isPending: false,
  }),
  useCorrectAttendanceRecord: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateTimetableException: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAdminOverrideAttendanceSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useBatches: () => ({
    data: [{ id: 'b-1', name: 'Class 10-A' }],
  }),
  useTeachers: () => ({
    data: [{ id: 't-1', name: 'Dr. Sharma', user: { name: 'Dr. Sharma', email: 'sharma@school.edu' } }],
  }),
  useAttendanceSummary: () => ({
    data: { batches: [] },
    isLoading: false,
  }),
  useStudents: () => ({
    data: [],
    isLoading: false,
  }),
  usePermissionGrants: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCreatePermissionGrant: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRevokePermissionGrant: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAttendancePolicy: () => ({
    data: {
      cutoffHour: 18,
      openBeforeMinutes: 15,
      gracePeriodMinutes: 30,
      timezone: 'Asia/Kolkata',
      allowTeacherHistoricalEdit: false,
      allowFinalizedCorrection: true,
    },
    isLoading: false,
  }),
  useUpdateAttendancePolicy: () => ({
    mutateAsync: mockUpdatePolicy,
    isPending: false,
  }),
}));

describe('AdminAttendance Screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Attendance Control Center header and KPI stats', () => {
    render(<AdminAttendance />);

    expect(screen.getByText(/Attendance Control Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Slots/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan Missing/i)).toBeInTheDocument();
  });

  it('triggers missing attendance scan when button clicked', () => {
    render(<AdminAttendance />);

    const scanBtn = screen.getByRole('button', { name: /scan missing/i });
    fireEvent.click(scanBtn);

    expect(mockDetectMissing).toHaveBeenCalled();
  });

  it('switches to Policy tab and displays configured timing policy controls', () => {
    render(<AdminAttendance />);

    const policyTabBtn = screen.getByRole('button', { name: /policy & permissions/i });
    fireEvent.click(policyTabBtn);

    expect(screen.getByText(/Attendance Timing & Cutoff Policy/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Submission Cutoff/i)).toBeInTheDocument();
    expect(screen.getByText(/Morning Early Window/i)).toBeInTheDocument();
    expect(screen.getByText(/Grace Period Buffer/i)).toBeInTheDocument();
    expect(screen.getByText(/Institute Timezone/i)).toBeInTheDocument();
    expect(screen.getByText(/Teacher Permission Grants/i)).toBeInTheDocument();
  });
});
