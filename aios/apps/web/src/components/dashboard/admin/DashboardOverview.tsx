'use client';

import { useAnalyticsOverview, useBatches } from '@/hooks/useApi';
import { BatchHeatmap } from './analytics/BatchHeatmap';
import { useState } from 'react';

export function DashboardOverview() {
  const { data, isLoading } = useAnalyticsOverview();
  const { data: batches } = useBatches();
  const [selectedBatchId, setSelectedBatchId] = useState('');

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-sm font-medium text-navy-500 mb-1">Total Students</h3>
          <p className="text-3xl font-bold text-navy-900">{isLoading ? '...' : data?.totalStudents || 0}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-navy-500 mb-1">Active Teachers</h3>
          <p className="text-3xl font-bold text-navy-900">{isLoading ? '...' : data?.totalTeachers || 0}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-navy-500 mb-1">Active Exams</h3>
          <p className="text-3xl font-bold text-navy-900">{isLoading ? '...' : data?.activeExams || 0}</p>
        </div>
      </div>

      {/* Batch Heatmap Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-semibold text-navy-900">Academic Insights</h2>
            <p className="text-sm text-navy-500">AI-powered struggle analysis powered by Pandas.</p>
          </div>
          <select 
            className="input max-w-xs bg-navy-50"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          >
            <option value="">Select a batch to analyze...</option>
            {batches?.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {selectedBatchId ? (
          <BatchHeatmap batchId={selectedBatchId} />
        ) : (
          <div className="py-12 text-center text-navy-500">
            Select a batch above to generate the automated heatmap.
          </div>
        )}
      </div>
    </div>
  );
}
