import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminOverview } from './AdminOverview';
import { useAdminStore } from '@/store/role-stores';

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
}));

// Mock hooks
vi.mock('@/features/students/hooks/useStudents', () => ({
  useStudentsStats: () => ({
    data: {
      total: 105,
      active: 101,
      inactive: 4,
      newLast30Days: 12,
      byBatch: [{ batchId: 'b1', batchName: 'Class 10 A', count: 20 }],
    },
  }),
}));

vi.mock('@/features/teachers/hooks/useTeachers', () => ({
  useTeachersStats: () => ({
    data: {
      total: 6,
      active: 5,
      inactive: 1,
      unassignedToSubject: 1,
      withBatchAssignment: 4,
      withoutBatchAssignment: 1,
    },
  }),
}));

vi.mock('@/features/batches/hooks/useBatches', () => ({
  useBatchesStats: () => ({
    data: {
      total: 14,
      active: 13,
      inactive: 1,
      byEnrollment: [
        { batchId: 'b1', batchName: 'Class 10 - Section C', studentCount: 12 },
        { batchId: 'b2', batchName: 'Class 10 - Section A', studentCount: 11 },
        { batchId: 'b3', batchName: 'Class 10 - Section B', studentCount: 10 },
        { batchId: 'b4', batchName: 'Class 11 - Section A', studentCount: 9 },
        { batchId: 'b5', batchName: 'Class 12 - Section A', studentCount: 8 },
      ],
    },
  }),
}));

vi.mock('@/hooks/useApi', () => ({
  useDoubts: () => ({ data: { meta: { total: 3 } } }),
  useAuditLogs: () => ({
    data: {
      data: [
        { id: '1', actor: { name: 'Rahul Verma' }, action: 'create', entity: 'exams', createdAt: '2026-10-08T01:29:10Z' },
        { id: '2', actor: { name: 'Rahul Verma' }, action: 'create', entity: 'papers', createdAt: '2026-10-08T01:29:09Z' },
      ],
    },
  }),
  useAttendanceSummary: () => ({
    data: { overallAttendancePct: 88, statusBreakdown: { PRESENT: 80, LATE: 5, ABSENT: 3, EXCUSED: 0 } },
    isPending: false,
  }),
  useExams: () => ({
    data: [
      { id: 'e1', status: 'PUBLISHED' },
      { id: 'e2', status: 'APPROVED' },
    ],
  }),
}));

describe('AdminOverview', () => {
  beforeEach(() => {
    useAdminStore.setState({ adminNav: 'Dashboard' });
  });

  it('renders all 4 clickable KPI cards and navigates on click', () => {
    render(<AdminOverview />);

    // Click Active Students
    const studentsKpi = screen.getByText('Active Students');
    fireEvent.click(studentsKpi);
    expect(useAdminStore.getState().adminNav).toBe('Students');

    // Click Active Teachers
    const teachersKpi = screen.getByText('Active Teachers');
    fireEvent.click(teachersKpi);
    expect(useAdminStore.getState().adminNav).toBe('Teachers');

    // Click Active Batches
    const batchesKpi = screen.getByText('Active Batches');
    fireEvent.click(batchesKpi);
    expect(useAdminStore.getState().adminNav).toBe('Batches');

    // Click Upcoming Exams
    const examsKpi = screen.getByText('Upcoming Exams');
    fireEvent.click(examsKpi);
    expect(useAdminStore.getState().adminNav).toBe('Exams');
  });

  it('renders the 4 list cards with vertical scroll containers', () => {
    const { container } = render(<AdminOverview />);

    // Check for custom-scrollbar and overflow-y-auto elements
    const scrollContainers = container.querySelectorAll('.overflow-y-auto.custom-scrollbar');
    // Top Batches, Pending Actions, Recent Activity, Roster Snapshot
    expect(scrollContainers.length).toBe(4);

    scrollContainers.forEach((el) => {
      expect(el.className).toContain('h-48');
      expect(el.className).toContain('overscroll-contain');
    });
  });

  it('renders responsive grid layout for desktop, tablet, and mobile', () => {
    const { container } = render(<AdminOverview />);
    const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    expect(grid).not.toBeNull();
  });
});
