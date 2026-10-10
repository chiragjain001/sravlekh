import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminReports } from './AdminReports';

vi.mock('@/hooks/useApi', () => ({
  useReportsList: () => ({
    data: {
      data: [
        {
          id: 'rep-01',
          type: 'REPORT_CARD',
          format: 'PDF',
          status: 'COMPLETE',
          scope: { studentId: 'stu-1' },
          fileUrl: 'https://example.com/rep1.html',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'rep-02',
          type: 'CLASS_REPORT',
          format: 'CSV',
          status: 'FAILED',
          scope: { batchId: 'batch-1' },
          fileUrl: null,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 2,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useBatches: () => ({
    data: {
      data: [
        { id: 'batch-1', name: 'Grade 10 - Alpha' },
        { id: 'batch-2', name: 'Grade 11 - Beta' },
      ],
    },
  }),
  useStudents: () => ({
    data: {
      data: [
        { id: 'stu-1', user: { name: 'Alice Smith' }, rollNumber: '101' },
        { id: 'stu-2', user: { name: 'Bob Jones' }, rollNumber: '102' },
      ],
    },
    isPending: false,
  }),
  useTeachers: () => ({
    data: {
      data: [
        { id: 'teach-1', user: { name: 'Dr. John Watson' } },
      ],
    },
    isPending: false,
  }),
  useRequestReport: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRetryReport: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('AdminReports Screen', () => {
  it('renders header, KPI metrics tiles, and reports table', () => {
    render(<AdminReports />);

    expect(screen.getByText(/Reports Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Reports/i)).toBeInTheDocument();
    expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready to View/i)).toBeInTheDocument();
    expect(screen.getByText(/Generation Failed/i)).toBeInTheDocument();

    // Table rows contains report cards
    expect(screen.getAllByText('Student Report Card').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Class Summary Report').length).toBeGreaterThan(0);
  });

  it('opens Create Report Dialog when clicking Generate Report', () => {
    render(<AdminReports />);

    const generateBtn = screen.getByRole('button', { name: /generate report/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText(/Generate Academic Report/i)).toBeInTheDocument();
    expect(screen.getByText(/Student Target Scope/i)).toBeInTheDocument();

    // Submit button should be disabled because no student is selected yet for REPORT_CARD
    const submitBtn = screen.getByRole('button', { name: /enqueue generation/i });
    expect(submitBtn).toBeDisabled();
  });

  it('enforces student selection for Student Report Card before enabling submission', () => {
    render(<AdminReports />);

    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    const submitBtn = screen.getByRole('button', { name: /enqueue generation/i });
    expect(submitBtn).toBeDisabled();

    // Find select containing Alice Smith
    const selects = screen.getAllByRole('combobox');
    const studentDropdown = selects.find((s) => s.innerHTML.includes('Alice Smith'));
    expect(studentDropdown).toBeDefined();

    if (studentDropdown) {
      fireEvent.change(studentDropdown, { target: { value: 'stu-1' } });
      expect(submitBtn).toBeEnabled();
    }
  });

  it('filters report rows when typing into search input', () => {
    render(<AdminReports />);

    const searchInput = screen.getByPlaceholderText(/search reports by title or id/i);
    fireEvent.change(searchInput, { target: { value: 'rep-02' } });

    expect(screen.queryByText(/rep-01/i)).not.toBeInTheDocument();
    expect(screen.getByText(/rep-02/i)).toBeInTheDocument();
  });
});
