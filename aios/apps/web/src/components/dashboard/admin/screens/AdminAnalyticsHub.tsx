'use client';
// AdminAnalyticsHub - Merged Analytics, Reports & Evaluation Quality
// Provides an executive command center combining academic intelligence,
// asynchronous report generation, and AI evaluation governance.

import { useState } from 'react';
import { BarChart3, FileText, Sparkles } from 'lucide-react';
import { AdminAnalytics }                  from './AdminAnalytics';
import { AdminReports }                    from './AdminReports';
import { AdminEvaluationQualityDashboard } from './AdminEvaluationQualityDashboard';

export type HubTab = 'overview' | 'reports' | 'eval-quality';

const TABS: { key: HubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview',     label: 'Analytics & Intelligence', icon: BarChart3 },
  { key: 'reports',      label: 'Reports Studio',          icon: FileText  },
  { key: 'eval-quality', label: 'Evaluation Quality',      icon: Sparkles  },
];

export function AdminAnalyticsHub() {
  const [tab, setTab] = useState<HubTab>('overview');
  const [preselectedBatchId, setPreselectedBatchId] = useState<string | undefined>(undefined);

  const handleCreateReportForBatch = (batchId: string) => {
    setPreselectedBatchId(batchId);
    setTab('reports');
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-6 py-2.5">
        <div className="flex items-center justify-between max-w-[1700px] mx-auto w-full">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-[12.5px] font-bold rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11.5px] font-medium text-slate-500 hidden sm:block">
            {tab === 'overview' && 'Real academic aggregates & topic diagnostics'}
            {tab === 'reports' && 'Asynchronous PDF/CSV document engine'}
            {tab === 'eval-quality' && 'AI governance & evaluation version audit'}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {tab === 'overview'     && <AdminAnalytics onGenerateBatchReport={handleCreateReportForBatch} />}
        {tab === 'reports'      && <AdminReports initialBatchId={preselectedBatchId} />}
        {tab === 'eval-quality' && <AdminEvaluationQualityDashboard />}
      </div>
    </div>
  );
}
