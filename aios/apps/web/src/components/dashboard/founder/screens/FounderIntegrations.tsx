'use client';
// ─── FounderIntegrations — real backend, read-only ─────────────────────────
// GET /founder/integrations — never returns a secret value or a fabricated
// masked key. Lists only integrations that genuinely exist in this codebase;
// the old mock screen's Razorpay/Mixpanel/etc. rows are simply gone, not
// replaced with something else invented. "Configured" reflects whether the
// env var is present; "wired" reflects whether anything actually reads it —
// SendGrid/WhatsApp/SMS are honestly reported as configured-but-unused,
// matching notice-dispatch.processor.ts's real stub behavior.

import { Plug, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useFounderIntegrations } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

interface Integration {
  key: string;
  label: string;
  configured: boolean;
  wired: boolean;
  status?: 'up' | 'down';
  latencyMs?: number | null;
  description: string;
}

export function FounderIntegrations() {
  const { data, isPending, isError } = useFounderIntegrations();
  const integrations: Integration[] = data ?? [];

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Integrations</h2>
        <p className="text-xs text-slate-500 mt-0.5">Read-only status for every real integration point in this codebase. No API keys are ever displayed here.</p>
      </div>

      {isPending && <SkeletonTable rows={6} cols={3} />}
      {isError && <EmptyState icon={<Plug className="w-6 h-6" />} title="Couldn't load integrations" />}

      {!isPending && !isError && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {integrations.map((i) => (
            <div key={i.key} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-slate-800">{i.label}</p>
                  {!i.wired && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3" /> not wired
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5">{i.description}</p>
                {i.status && (
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    Live check: {i.status === 'up' ? `up, ${i.latencyMs}ms` : 'down / unreachable'}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {i.configured
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <XCircle className="w-4 h-4 text-slate-300" />}
                <span className={`text-[11px] font-bold ${i.configured ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {i.configured ? 'Configured' : 'Not configured'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
