import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminStudents } from './AdminStudents';

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

vi.mock('@/features/students/hooks/useStudents', () => ({
  useStudentsList: () => ({
    data: { data: [], total: 0, totalPages: 1 },
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useStudentsStats: () => ({
    data: { total: 120, active: 110, inactive: 10, newLast30Days: 15, byBatch: [] },
    isPending: false,
    isError: false,
  }),
  useStudentProfile: () => ({
    data: null,
    isPending: false,
    isError: false,
  }),
  useCreateStudent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateStudent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteStudent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkDeleteStudents: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadBulkStudentTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useValidateBulkStudents: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCommitBulkStudents: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadBulkErrorReport: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useApi', () => ({
  useBatches: () => ({ data: [] }),
}));

describe('AdminStudents screen UI enhancements', () => {
  it('renders iOS-style segmented tabs and premium action buttons', () => {
    render(<AdminStudents />);

    // Header title
    expect(screen.getByText('Students Directory')).toBeInTheDocument();

    // Export button, Bulk Import button, and Enroll Student button
    const exportBtn = screen.getByRole('button', { name: /export/i });
    const bulkImportBtn = screen.getByRole('button', { name: /bulk import/i });
    const enrollBtn = screen.getByRole('button', { name: /enroll student/i });
    expect(exportBtn).toBeInTheDocument();
    expect(bulkImportBtn).toBeInTheDocument();
    expect(enrollBtn).toBeInTheDocument();

    // Segmented tab list with role="tablist"
    const tablist = screen.getByRole('tablist', { name: /student view selection/i });
    expect(tablist).toBeInTheDocument();

    // Segmented tabs
    const listTab = screen.getByRole('tab', { name: /student list/i });
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i });

    expect(listTab).toHaveAttribute('aria-selected', 'true');
    expect(analyticsTab).toHaveAttribute('aria-selected', 'false');

    // Clicking analytics tab switches active segment
    fireEvent.click(analyticsTab);
    expect(analyticsTab).toHaveAttribute('aria-selected', 'true');
    expect(listTab).toHaveAttribute('aria-selected', 'false');
  });

  it('opens Bulk Enrollment Dialog when clicking Bulk Import', () => {
    render(<AdminStudents />);

    const bulkImportBtn = screen.getByRole('button', { name: /bulk import/i });
    fireEvent.click(bulkImportBtn);

    expect(screen.getByText('Bulk Student Enrollment')).toBeInTheDocument();
    expect(screen.getByText(/Download Smart Excel Template/i)).toBeInTheDocument();
  });
});

