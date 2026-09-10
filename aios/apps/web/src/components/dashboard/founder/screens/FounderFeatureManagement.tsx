'use client';
// ─── FounderFeatureManagement — real backend ───────────────────────────────
// Rewired onto the actual mechanism: Institute.featureFlags, read through
// FeatureFlagsService and genuinely enforced by capture-providers/
// ai-evaluation/documents (Founder Console Phase 3) — not the previous
// platform-wide feature catalog with fake rollout%/adoption-trend charts,
// which had nothing real behind it. Flags are per-institute; toggling one
// here calls the same PATCH /founder/feature-flags endpoint FounderInstitutes
// already used for plan changes.

import { useState } from 'react';
import { Search, ToggleLeft, ToggleRight, Building2 } from 'lucide-react';
import { useFounderInstitutes, useFounderInstituteDetail, useUpdateFeatureFlag } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

// The only flags any backend code actually reads (Founder Console Phase 3).
// Adding a flag here without wiring an isEnabled() check somewhere is exactly
// the "frontend-only feature flag" anti-pattern the architecture rules forbid
// — keep this list in lockstep with real enforcement call sites.
const KNOWN_FLAGS: { key: string; label: string; description: string; enforcedIn: string }[] = [
  { key: 'omrCapture', label: 'OMR Capture', description: 'Allows creating an OMR capture provider for assessments.', enforcedIn: 'capture-providers.service.ts' },
  { key: 'aiEvaluation', label: 'AI Evaluation', description: 'Allows queuing AI-assisted evaluation jobs.', enforcedIn: 'ai-evaluation.service.ts' },
  { key: 'documentProcessing', label: 'Document Processing', description: 'Allows creating document bundles for the photo-capture pipeline.', enforcedIn: 'documents.service.ts' },
];

interface InstituteRow {
  id: string;
  name: string;
  plan: string;
  status: string;
}

export function FounderFeatureManagement() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isPending, isError } = useFounderInstitutes(search.trim() ? { search: search.trim() } : undefined);
  const rows: InstituteRow[] = data ?? [];
  const selected = selectedId ?? rows[0]?.id ?? null;

  return (
    <div className="p-6 max-w-[1300px] mx-auto w-full h-full flex gap-5">
      <div className="w-72 shrink-0 space-y-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Feature Flags</h2>
          <p className="text-xs text-slate-500 mt-0.5">Per-institute toggles, genuinely enforced server-side.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search institutes..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {isPending && <SkeletonTable rows={6} cols={1} />}
        {isError && <EmptyState icon={<Building2 className="w-5 h-5" />} title="Couldn't load institutes" />}
        {!isPending && !isError && (
          <ul className="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${selected === r.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {r.name}
                  <span className="block text-[10.5px] text-slate-400 font-normal">{r.plan} · {r.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1">
        {selected ? <InstituteFlagPanel instituteId={selected} /> : <EmptyState icon={<Building2 className="w-6 h-6" />} title="Select an institute" />}
      </div>
    </div>
  );
}

function InstituteFlagPanel({ instituteId }: { instituteId: string }) {
  const { data: detail, isPending, isError } = useFounderInstituteDetail(instituteId);
  const updateFlag = useUpdateFeatureFlag();

  if (isPending) return <SkeletonTable rows={3} cols={1} />;
  if (isError || !detail) return <EmptyState icon={<Building2 className="w-6 h-6" />} title="Couldn't load institute detail" />;

  const flags: Record<string, boolean> = detail.featureFlags ?? {};

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-[13.5px] font-bold text-slate-900">{detail.name}</h3>
        <p className="text-[11.5px] text-slate-400 mt-0.5">{detail.plan} plan · {detail.status}</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {KNOWN_FLAGS.map((f) => {
          const enabled = flags[f.key] === true;
          return (
            <li key={f.key} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[12.5px] font-semibold text-slate-800">{f.label}</p>
                <p className="text-[11.5px] text-slate-500 mt-0.5">{f.description}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">enforced in {f.enforcedIn}</p>
              </div>
              <button
                onClick={() => updateFlag.mutate({ instituteId, flag: f.key, enabled: !enabled })}
                disabled={updateFlag.isPending}
                className="shrink-0"
                aria-label={`Toggle ${f.label}`}
              >
                {enabled
                  ? <ToggleRight className="w-9 h-9 text-emerald-500" />
                  : <ToggleLeft className="w-9 h-9 text-slate-300" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
