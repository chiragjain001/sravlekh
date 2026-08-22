'use client';
// ─── FounderHealth — real backend, live latency checks ─────────────────────
// 05-API-SPECIFICATION.md: GET /founder/health returns latency stats for
// NestJS, FastAPI, PostgreSQL. Polls every 30s (see useFounderHealth).

import { Server, Database, Cpu, RefreshCw } from 'lucide-react';
import { useFounderHealth } from '@/hooks/useApi';
import { SkeletonCardGrid, EmptyState } from '@/components/ui/foundation';

interface ServiceHealth {
  status: 'up' | 'down';
  latencyMs: number | null;
}

const SERVICES: { key: 'nestjs' | 'postgres' | 'fastapi'; label: string; icon: React.ReactNode }[] = [
  { key: 'nestjs', label: 'NestJS API', icon: <Server className="w-4 h-4" /> },
  { key: 'postgres', label: 'PostgreSQL', icon: <Database className="w-4 h-4" /> },
  { key: 'fastapi', label: 'Python AI Engine', icon: <Cpu className="w-4 h-4" /> },
];

export function FounderHealth() {
  const { data, isPending, isError, refetch, isFetching } = useFounderHealth();

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Platform Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live latency checks across every backend service. Refreshes every 30s.</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {isPending && <SkeletonCardGrid count={3} />}
      {isError && <EmptyState icon={<Server className="w-6 h-6" />} title="Couldn't reach the health endpoint" />}

      {!isPending && !isError && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  );
}
