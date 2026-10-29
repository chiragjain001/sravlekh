import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminBatches } from './AdminBatches';

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

vi.mock('@/features/batches/hooks/useBatches', () => ({
  useBatchesList: () => ({
    data: { data: [], total: 0, totalPages: 1 },
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useBatchesStats: () => ({
    data: { total: 12, active: 10, inactive: 2, byEnrollment: [] },
    isPending: false,
    isError: false,
  }),
  useBatchProfile: () => ({
    data: null,
    isPending: false,
    isError: false,
  }),
  useCreateBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBatch: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkDeleteBatches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadBulkBatchTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useValidateBulkBatches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCommitBulkBatches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadBulkBatchErrorReport: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useApi', () => ({
  useBatches: () => ({ data: [] }),
}));

describe('AdminBatches screen UI enhancements', () => {
  it('renders iOS-style segmented tabs and premium action buttons', () => {
    render(<AdminBatches />);

    // Header title
    expect(screen.getByText(/Batches & Cohorts/i)).toBeInTheDocument();

    // Export button, Bulk Import button, and Create Batch button
    const exportBtn = screen.getByRole('button', { name: /export/i });
    const bulkImportBtn = screen.getByRole('button', { name: /bulk import/i });
    const createBtn = screen.getByRole('button', { name: /create batch/i });
    expect(exportBtn).toBeInTheDocument();
    expect(bulkImportBtn).toBeInTheDocument();
    expect(createBtn).toBeInTheDocument();

    // Segmented tab list with role="tablist"
    const tablist = screen.getByRole('tablist', { name: /batch view selection/i });
    expect(tablist).toBeInTheDocument();

    // Both tabs present
    const batchListTab = screen.getByRole('tab', { name: /batch list/i });
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
    expect(batchListTab).toBeInTheDocument();
    expect(analyticsTab).toBeInTheDocument();
    expect(batchListTab).toHaveAttribute('aria-selected', 'true');
    expect(analyticsTab).toHaveAttribute('aria-selected', 'false');

    // Search input
    const searchInput = screen.getByPlaceholderText(/search batch name, section/i);
    expect(searchInput).toBeInTheDocument();

    // Filters button
    const filterBtn = screen.getByRole('button', { name: /filters/i });
    expect(filterBtn).toBeInTheDocument();
  });
});
