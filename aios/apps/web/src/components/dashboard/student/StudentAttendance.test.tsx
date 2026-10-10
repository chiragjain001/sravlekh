import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudentAttendance } from './StudentAttendance';

vi.mock('@/hooks/useApi', () => ({
  useStudentAttendance: () => ({
    data: {
      overall: {
        percentage: 85,
        attended: 17,
        total: 20,
        breakdown: { PRESENT: 17, ABSENT: 3, LATE: 0, EXCUSED: 0 },
      },
      subjects: [
        {
          subjectId: 'sub-math',
          subjectName: 'Mathematics',
          percentage: 90,
          attended: 9,
          total: 10,
        },
        {
          subjectId: 'sub-phy',
          subjectName: 'Physics',
          percentage: 80,
          attended: 8,
          total: 10,
        },
      ],
      history: [
        {
          id: 'rec-1',
          date: '2026-10-09',
          status: 'PRESENT',
          subjectName: 'Mathematics',
          periodNumber: 1,
          batchName: 'Class 10-A',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

describe('StudentAttendance Screen', () => {
  it('renders overall attendance percentage and summary metrics', () => {
    render(<StudentAttendance />);

    expect(screen.getByText(/My Attendance/i)).toBeInTheDocument();
    expect(screen.getByText(/85%/i)).toBeInTheDocument();
    expect(screen.getByText(/Overall Attendance/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mathematics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Physics/i).length).toBeGreaterThan(0);
  });

  it('renders official finalized history list', () => {
    render(<StudentAttendance />);

    expect(screen.getByText(/Attendance Log/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mathematics/i).length).toBeGreaterThan(0);
  });
});
