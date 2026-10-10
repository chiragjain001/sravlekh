import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminAnalyticsHub } from './AdminAnalyticsHub';

// Mock child screens to isolate hub navigation behavior
vi.mock('./AdminAnalytics', () => ({
  AdminAnalytics: ({ onGenerateBatchReport }: { onGenerateBatchReport?: (batchId: string) => void }) => (
    <div data-testid="screen-analytics">
      <span>Analytics Screen Content</span>
      <button onClick={() => onGenerateBatchReport?.('batch-123')}>Generate Report For Batch</button>
    </div>
  ),
}));

vi.mock('./AdminReports', () => ({
  AdminReports: ({ initialBatchId }: { initialBatchId?: string }) => (
    <div data-testid="screen-reports">
      <span>Reports Screen Content</span>
      {initialBatchId && <span data-testid="initial-batch">{initialBatchId}</span>}
    </div>
  ),
}));

vi.mock('./AdminEvaluationQualityDashboard', () => ({
  AdminEvaluationQualityDashboard: () => (
    <div data-testid="screen-eval-quality">
      <span>Evaluation Quality Dashboard Content</span>
    </div>
  ),
}));

describe('AdminAnalyticsHub', () => {
  it('renders all three primary section tabs', () => {
    render(<AdminAnalyticsHub />);

    expect(screen.getByRole('button', { name: /analytics & intelligence/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reports studio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /evaluation quality/i })).toBeInTheDocument();
  });

  it('renders Analytics & Intelligence screen by default', () => {
    render(<AdminAnalyticsHub />);

    expect(screen.getByTestId('screen-analytics')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-reports')).not.toBeInTheDocument();
    expect(screen.queryByTestId('screen-eval-quality')).not.toBeInTheDocument();
  });

  it('switches tabs on user click', () => {
    render(<AdminAnalyticsHub />);

    // Click Reports Studio
    fireEvent.click(screen.getByRole('button', { name: /reports studio/i }));
    expect(screen.getByTestId('screen-reports')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-analytics')).not.toBeInTheDocument();

    // Click Evaluation Quality
    fireEvent.click(screen.getByRole('button', { name: /evaluation quality/i }));
    expect(screen.getByTestId('screen-eval-quality')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-reports')).not.toBeInTheDocument();
  });

  it('navigates to Reports Studio with preselected batch when triggered from Analytics', () => {
    render(<AdminAnalyticsHub />);

    // Click button inside mock Analytics screen
    fireEvent.click(screen.getByRole('button', { name: /generate report for batch/i }));

    // Should switch to Reports screen and pass preselected batch
    expect(screen.getByTestId('screen-reports')).toBeInTheDocument();
    expect(screen.getByTestId('initial-batch')).toHaveTextContent('batch-123');
  });
});
