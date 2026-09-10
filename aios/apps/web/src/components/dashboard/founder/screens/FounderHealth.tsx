'use client';
// ─── FounderHealth — real backend, live latency checks ─────────────────────
// GET /founder/health returns latency stats for NestJS, FastAPI, PostgreSQL,
// Redis. Polls every 30s (see useFounderHealth). Queue-depth/failed-job
// counts (Founder Console Phase 6) come from GET /founder/health/queues —
// real BullMQ getJobCounts() per queue, nothing derived/estimated.

import { Server, Database, Cpu, RefreshCw, Zap, ListTodo } from 'lucide-react';
import { useFounderHealth, useFounderQueueMetrics } from '@/hooks/useApi';
import { SkeletonCardGrid, SkeletonTable, EmptyState } from '@/components/ui/foundation';

interface ServiceHealth {
  status: 'up' | 'down';
  latencyMs: number | null;
}

const SERVICES: { key: 'nestjs' | 'postgres' | 'fastapi' | 'redis'; label: string; icon: React.ReactNode }[] = [
  { key: 'nestjs', label: 'NestJS API', icon: <Server className="w-4 h-4" /> },
  { key: 'postgres', label: 'PostgreSQL', icon: <Database className="w-4 h-4" /> },
  { key: 'fastapi', label: 'Python AI Engine', icon: <Cpu className="w-4 h-4" /> },
  { key: 'redis', label: 'Redis', icon: <Zap className="w-4 h-4" /> },
];

interface QueueMetric {
  name: string;
  available: boolean;
  counts: { waiting: number; active: number; completed: number; failed: number; delayed: number } | null;
}

export function FounderHealth() {
  const { data, isPending, isError, refetch, isFetching } = useFounderHealth();
  const { data: queueData, isPending: queuePending, isError: queueError } = useFounderQueueMetrics();
  const queues: QueueMetric[] = queueData ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Platform Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live latency checks across every backend service. Refreshes every 30s.</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {isPending && <SkeletonCardGrid count={4} />}
      {isError && <EmptyState icon={<Server className="w-6 h-6" />} title="Couldn't reach the health endpoint" />}

      {!isPending && !isError && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {SERVICES.map((s) => {
            const health: ServiceHealth = data[s.key];
            const isUp = health?.status === 'up';
            return (
              <div key={s.key} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-600">{s.icon}<span className="text-[13px] font-bold">{s.label}</span></div>
                  <span className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
                <p className={`text-[22px] font-bold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>{isUp ? 'Operational' : 'Down'}</p>
                <p className="text-[11px] text-slate-400 mt-1">{health?.latencyMs != null ? `${health.latencyMs}ms latency` : 'No response'}</p>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ListTodo className="w-4 h-4 text-slate-400" />
          <h3 className="text-[13px] font-bold text-slate-900">Processing queues</h3>
        </div>

        {queuePending && <SkeletonTable rows={6} cols={5} />}
        {queueError && <EmptyState icon={<ListTodo className="w-6 h-6" />} title="Couldn't load queue metrics" />}

        {!queuePending && !queueError && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Queue</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Waiting</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Active</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Delayed</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.name} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-700">{q.name}</td>
                    {q.available && q.counts ? (
                      <>
                        <td className="px-4 py-2.5 text-right text-[12px] text-slate-600">{q.counts.waiting}</td>
                        <td className="px-4 py-2.5 text-right text-[12px] text-slate-600">{q.counts.active}</td>
                        <td className="px-4 py-2.5 text-right text-[12px] text-slate-600">{q.counts.delayed}</td>
                        <td className={`px-4 py-2.5 text-right text-[12px] font-bold ${q.counts.failed > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{q.counts.failed}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-4 py-2.5 text-right text-[11.5px] text-slate-400">not tracked — Redis unreachable</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
