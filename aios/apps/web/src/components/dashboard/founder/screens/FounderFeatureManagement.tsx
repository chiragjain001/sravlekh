'use client';

import { useState, useMemo } from 'react';
import {
  Search, ToggleLeft, ToggleRight, Building2, Check,
  Layers, Sparkles, BookOpen, Clock, FileText, CheckCircle2,
  HelpCircle, MessageSquare, ShieldCheck, ChevronRight, X
} from 'lucide-react';
import {
  useFounderInstitutes,
  useFounderModules,
  useUpdateFounderModules,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

interface InstituteRow {
  id: string;
  name: string;
  plan: string;
  status: string;
}

const PRESET_CARDS = [
  {
    id: 'SCHOOL_CORE',
    title: 'School Core & ERP',
    badge: 'Foundation',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-100',
    description: 'Daily school operations: Students, Teachers, QR Attendance, Timetable & Notices.',
    icon: Building2,
    gradient: 'from-sky-500/10 to-indigo-500/5',
    activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
  },
  {
    id: 'EXAM_OMR',
    title: 'Exam & OMR Pack',
    badge: 'Coaching Choice',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-100',
    description: 'Question Bank, Paper Builder, Exam Schedules & High-Speed OMR Sheet Scanner.',
    icon: FileText,
    gradient: 'from-amber-500/10 to-orange-500/5',
    activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
  },
  {
    id: 'AI_EVALUATION',
    title: 'AI Copy Checking Suite',
    badge: 'High Value',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
    description: 'Handwritten Answer Sheet scanning, Rubric AI Evaluation & Teacher Copilot.',
    icon: Sparkles,
    gradient: 'from-violet-500/10 to-purple-500/5',
    activeBorder: 'border-violet-500 ring-2 ring-violet-500/20',
  },
  {
    id: 'ALL_IN_ONE',
    title: 'All-in-One Enterprise',
    badge: 'Full Suite',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    description: 'Every platform capability unlocked: ERP, OMR, AI Digital Evaluation & Doubts.',
    icon: Layers,
    gradient: 'from-emerald-500/10 to-teal-500/5',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
  },
];

const MODULE_CATEGORIES = [
  {
    category: 'Academics & Daily School Operations',
    modules: [
      { key: 'academics', label: 'Academic Directory', desc: 'Manage students, teachers, branches and batch enrollments', icon: BookOpen },
      { key: 'attendance', label: 'Attendance (QR & Manual)', desc: 'Daily roll call, barcode/QR check-in, and monthly attendance logs', icon: Clock },
      { key: 'timetable', label: 'Timetable & Class Schedules', desc: 'Weekly bell schedules, subject slot assignments, and teacher loads', icon: Clock },
      { key: 'communication', label: 'Notices & Communication', desc: 'Targeted broadcast announcements and parent notification dispatch', icon: MessageSquare },
      { key: 'student360', label: 'Student 360 Analytics', desc: 'Student profile mastery tracking, weak topics, and progress history', icon: CheckCircle2 },
    ],
  },
  {
    category: 'Examination & OMR Automation',
    modules: [
      { key: 'questionBank', label: 'Question Bank & Taxonomy', desc: 'Bloom taxonomy-tagged question archive with difficulty parameters', icon: FileText },
      { key: 'paperBuilder', label: 'AI Paper Builder', desc: 'Automated test generation with blueprint balancing and answer keys', icon: Sparkles },
      { key: 'exams', label: 'Exam Scheduling & Hall Tickets', desc: 'Offline exam scheduling, roll generation, and mark entry tables', icon: FileText },
      { key: 'omrScanning', label: 'Automated OMR Scanner', desc: 'Camera/flatbed OMR sheet import and bubble detection pipeline', icon: FileText },
    ],
  },
  {
    category: 'AI Digital Evaluation & Student Support',
    modules: [
      { key: 'aiCopyChecking', label: 'AI Digital Copy Checking', desc: 'Handwritten answer sheet scanning, AI evaluation, rubrics & audit', icon: Sparkles },
      { key: 'doubts', label: 'Doubt Resolution Forum', desc: 'Student doubt asking platform and teacher response threads', icon: HelpCircle },
      { key: 'reports', label: 'Report Cards & Performance', desc: 'Automated printable report cards, rank sheets, and class telemetry', icon: CheckCircle2 },
    ],
  },
];

export function FounderFeatureManagement() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);

  const { data, isPending, isError } = useFounderInstitutes(search.trim() ? { search: search.trim() } : undefined);
  const rows: InstituteRow[] = data ?? [];
  const selectedInstitute = useMemo(() => {
    return rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  }, [rows, selectedId]);

  return (
    <div className="p-3 sm:p-6 max-w-[1300px] mx-auto w-full space-y-4">
      {/* Header with Apple-like subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Module Distribution &amp; Packaging
            <span className="text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
              No Confusion Packs
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign ready-made combination packs or toggle individual modules per institute with instant enforcement.
          </p>
        </div>

        {/* Mobile Switch Institute Button */}
        {selectedInstitute && (
          <button
            onClick={() => setMobileSelectorOpen(true)}
            className="sm:hidden flex items-center justify-between w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">{selectedInstitute.name}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex gap-6 items-start">
        {/* Desktop Institute Sidebar (Hidden on mobile) */}
        <div className="hidden sm:block w-72 shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search institutes..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100/80 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder-slate-400 transition-all"
            />
          </div>

          {isPending && <SkeletonTable rows={6} cols={1} />}
          {isError && <EmptyState icon={<Building2 className="w-5 h-5" />} title="Couldn't load institutes" />}
          {!isPending && !isError && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-1.5 space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto">
              {rows.map((r) => {
                const isSelected = selectedInstitute?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate">{r.name}</div>
                    <div className={`text-[10.5px] mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {r.plan} · {r.status}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Configuration Panel */}
        <div className="flex-1 min-w-0">
          {selectedInstitute ? (
            <InstituteModulePanel instituteId={selectedInstitute.id} instituteName={selectedInstitute.name} />
          ) : (
            <EmptyState icon={<Building2 className="w-8 h-8" />} title="Select an institute to manage modules" />
          )}
        </div>
      </div>

      {/* Mobile Institute Selection Drawer */}
      {mobileSelectorOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileSelectorOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl max-h-[80vh] flex flex-col p-4 shadow-2xl animate-fade-in">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Select Institute</h3>
              <button onClick={() => setMobileSelectorOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="pt-3 pb-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 text-xs bg-slate-100 border-0 rounded-xl focus:bg-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-slate-50">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    setMobileSelectorOpen(false);
                  }}
                  className="w-full text-left py-2.5 px-2 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                    <p className="text-[10px] text-slate-400">{r.plan} · {r.status}</p>
                  </div>
                  {selectedInstitute?.id === r.id && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InstituteModulePanel({ instituteId, instituteName }: { instituteId: string; instituteName: string }) {
  const { data: moduleData, isPending, isError } = useFounderModules(instituteId);
  const updateModules = useUpdateFounderModules();

  const [activePreset, setActivePreset] = useState<string>('CUSTOM');
  const [localModules, setLocalModules] = useState<Record<string, boolean>>({});

  // Sync state when backend data loads
  const currentPreset = moduleData?.preset ?? 'CUSTOM';
  const modulesState = useMemo(() => {
    return { ...(moduleData?.modules ?? {}), ...localModules };
  }, [moduleData, localModules]);

  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    const presetDef = PRESET_CARDS.find((p) => p.id === presetId);
    if (!presetDef) return;

    const availablePresets = moduleData?.availablePresets ?? {};
    const presetModules = availablePresets[presetId]?.modules;
    if (presetModules) {
      setLocalModules(presetModules);
      updateModules.mutate({
        instituteId,
        preset: presetId,
        modules: presetModules,
      });
    }
  };

  const toggleModule = (moduleKey: string) => {
    const next = { ...modulesState, [moduleKey]: !modulesState[moduleKey] };
    setLocalModules(next);
    setActivePreset('CUSTOM');
    updateModules.mutate({
      instituteId,
      preset: 'CUSTOM',
      modules: next,
    });
  };

  if (isPending) return <SkeletonTable rows={4} cols={2} />;
  if (isError) return <EmptyState icon={<Layers className="w-6 h-6" />} title="Couldn't load modules" />;

  const displayPreset = activePreset === 'CUSTOM' ? currentPreset : activePreset;

  return (
    <div className="space-y-5">
      {/* Target Institute Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">Configuring School</span>
          <h3 className="text-[16px] font-bold text-slate-900 mt-0.5">{instituteName}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Active Package Preset: <strong className="text-indigo-600">{displayPreset}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            Live Sync Active
          </span>
        </div>
      </div>

      {/* 4 Ready-Made Combination Packs */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Ready-Made Combination Packs (1-Click Apply)
          </h4>
          <span className="text-[11px] text-slate-400">Clicking applies instantly</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_CARDS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = displayPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                disabled={updateModules.isPending}
                className={`relative text-left p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                  isSelected
                    ? `${preset.activeBorder} bg-white shadow-sm`
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${preset.gradient} flex items-center justify-center text-slate-800`}>
                    <Icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                </div>
                <h5 className="text-[13px] font-bold text-slate-900">{preset.title}</h5>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{preset.description}</p>
                {isSelected && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                    <Check className="w-3.5 h-3.5" /> Active Pack
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Individual Custom Module Switchboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Custom Module Switchboard (1-Click Toggle)
          </h4>
          <span className="text-[11px] text-slate-500">Fine-tune individual features</span>
        </div>

        {MODULE_CATEGORIES.map((cat) => (
          <div key={cat.category} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
              <h5 className="text-[12px] font-bold text-slate-800">{cat.category}</h5>
            </div>
            <ul className="divide-y divide-slate-100">
              {cat.modules.map((m) => {
                const Icon = m.icon;
                const isEnabled = modulesState[m.key] !== false;
                return (
                  <li key={m.key} className="p-3.5 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-800">{m.label}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-tight">{m.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleModule(m.key)}
                      disabled={updateModules.isPending}
                      className="shrink-0 p-1 rounded-lg focus:outline-none transition-transform active:scale-95"
                      aria-label={`Toggle ${m.label}`}
                    >
                      {isEnabled ? (
                        <ToggleRight className="w-9 h-9 text-emerald-500 transition-colors" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300 transition-colors" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
