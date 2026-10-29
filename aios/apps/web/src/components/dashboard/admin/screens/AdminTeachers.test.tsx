import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminTeachers } from './AdminTeachers';

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

vi.mock('@/features/teachers/hooks/useTeachers', () => ({
  useTeachersList: () => ({
    data: { data: [], total: 0, totalPages: 1 },
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useTeachersStats: () => ({
    data: { total: 25, active: 24, inactive: 1, subjectsCovered: 8, unassignedToSubject: 0, bySubject: [] },
    isPending: false,
    isError: false,
  }),
  useTeacherProfile: () => ({
    data: null,
    isPending: false,
    isError: false,
  }),
  useCreateTeacher: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTeacher: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTeacher: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkDeleteTeachers: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadBulkTeacherTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useValidateBulkTeachers: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCommitBulkTeachers: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadBulkTeacherErrorReport: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useApi', () => ({
  useSubjects: () => ({ data: [] }),
  useBatches: () => ({ data: [] }),
}));

describe('AdminTeachers screen UI enhancements', () => {
  it('renders iOS-style segmented tabs and premium action buttons', () => {
    render(<AdminTeachers />);

    // Header title
    expect(screen.getByText('Faculty Directory')).toBeInTheDocument();

    // Export button, Bulk Import button, and Add Teacher button
    const exportBtn = screen.getByRole('button', { name: /export/i });
    const bulkImportBtn = screen.getByRole('button', { name: /bulk import/i });
    const addTeacherBtn = screen.getByRole('button', { name: /add teacher/i });
    expect(exportBtn).toBeInTheDocument();
    expect(bulkImportBtn).toBeInTheDocument();
    expect(addTeacherBtn).toBeInTheDocument();

    // Segmented tab list with role="tablist"
    const tablist = screen.getByRole('tablist', { name: /faculty view selection/i });
    expect(tablist).toBeInTheDocument();

    // Segmented tabs
    const listTab = screen.getByRole('tab', { name: /faculty list/i });
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i });

    expect(listTab).toHaveAttribute('aria-selected', 'true');
    expect(analyticsTab).toHaveAttribute('aria-selected', 'false');

    // Clicking analytics tab switches active segment
    fireEvent.click(analyticsTab);
    expect(analyticsTab).toHaveAttribute('aria-selected', 'true');
    expect(listTab).toHaveAttribute('aria-selected', 'false');
  });
});
