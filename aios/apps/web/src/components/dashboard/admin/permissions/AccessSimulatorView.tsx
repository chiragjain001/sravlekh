'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  KeyRound,
} from 'lucide-react';
import {
  useTeachers,
  useRolesAndPermissions,
  useSimulateAccess,
  useBatches,
  useSubjects,
} from '@/hooks/useApi';
import { AppleDropdown, type AppleDropdownOption } from '@/components/ui/AppleDropdown';
import type { SimulationResult } from '@/types/permissions.types';

export function AccessSimulatorView() {
  const { data: teachersResp, isLoading: teachersLoading } = useTeachers();
  const { data: rolesData, isLoading: rolesLoading } = useRolesAndPermissions();
  const { data: batchesResp } = useBatches();
  const { data: subjectsResp } = useSubjects();

  const simulateMutation = useSimulateAccess();

  const teachers = (teachersResp?.data ?? []).filter((t: any) => !!t.user?.id);
  const batches: { id: string; name: string }[] = batchesResp?.data ?? batchesResp ?? [];
  const subjects: { id: string; name: string }[] = subjectsResp ?? [];
  const templates = rolesData?.templates ?? [];

  const [mode, setMode] = useState<'USER' | 'ROLE'>('USER');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const teacherDropdownOptions: AppleDropdownOption[] = teachers.map((t: any) => ({
    value: t.user.id,
    label: t.user.name,
    sublabel: t.user.email,
    badge: t.user.role,
  }));

  const roleDropdownOptions: AppleDropdownOption[] = templates.map((r) => ({
    value: r.id,
    label: r.name,
    sublabel: `${r.permissions.length} capabilities · ${r.baseRole}`,
    badge: r.isSystem ? 'System' : 'Custom',
  }));

  const batchDropdownOptions: AppleDropdownOption[] = [
    { value: '', label: 'Institute-wide (All Batches)' },
    ...batches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const subjectDropdownOptions: AppleDropdownOption[] = [
    { value: '', label: 'All Subjects' },
    ...subjects.map((s) => ({ value: s.id, label: s.name })),
  ];

  const handleRunSimulation = async () => {
    if (mode === 'USER' && !selectedUserId) return;
    if (mode === 'ROLE' && !selectedRoleId) return;

    const res = await simulateMutation.mutateAsync({
      userId: mode === 'USER' ? selectedUserId : undefined,
      roleId: mode === 'ROLE' ? selectedRoleId : undefined,
      batchId: selectedBatchId || undefined,
      subjectId: selectedSubjectId || undefined,
    });

    setSimulationResult(res as SimulationResult);
  };

  return (
    <div className="space-y-6">
      {/* ── Simulator Configuration Card ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Access Policy Simulation &amp; Impact Analysis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluate real server authorization decisions and preview accessible UI modules and risks.
            </p>
          </div>

          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-semibold text-slate-600 self-start sm:self-auto">
            <button
              onClick={() => {
                setMode('USER');
                setSimulationResult(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === 'USER' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Simulate Staff Member
            </button>
            <button
              onClick={() => {
                setMode('ROLE');
                setSimulationResult(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === 'ROLE' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Simulate Role Template
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {mode === 'USER' ? 'Select Staff Member *' : 'Select Role Template *'}
            </label>
            {mode === 'USER' ? (
              <AppleDropdown
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={teacherDropdownOptions}
                placeholder="Choose teacher or admin…"
                searchable
                disabled={teachersLoading}
              />
            ) : (
              <AppleDropdown
                value={selectedRoleId}
                onChange={setSelectedRoleId}
                options={roleDropdownOptions}
                placeholder="Choose role template…"
                searchable
                disabled={rolesLoading}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Simulate Target Batch Scope
            </label>
            <AppleDropdown
              value={selectedBatchId}
              onChange={setSelectedBatchId}
              options={batchDropdownOptions}
              placeholder="Institute-wide"
              searchable
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Simulate Target Subject Scope
            </label>
            <AppleDropdown
              value={selectedSubjectId}
              onChange={setSelectedSubjectId}
              options={subjectDropdownOptions}
              placeholder="All Subjects"
              searchable
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleRunSimulation}
            disabled={
              (mode === 'USER' && !selectedUserId) ||
              (mode === 'ROLE' && !selectedRoleId) ||
              simulateMutation.isPending
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
          >
            {simulateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Run Server-Side Policy Simulation
          </button>
        </div>
      </div>

      {/* ── Simulation Results View ─────────────────────────────────────── */}
      {simulationResult ? (
        <div className="space-y-5 animate-fadein">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Effective Capabilities</span>
              <div className="text-xl font-bold text-indigo-600">
                {simulationResult.totalGrantedCount} Active
              </div>
              <p className="text-[11px] text-slate-400">Validated across base roles and direct grants</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Accessible UI Modules</span>
              <div className="text-xl font-bold text-slate-900">
                {simulationResult.accessibleModules.length} Modules
              </div>
              <p className="text-[11px] text-slate-400">Navigation sections visible to this actor</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Sensitive / Critical Flags</span>
              <div className="text-xl font-bold text-amber-600">
                {simulationResult.sensitiveFlags.length} Elevated
              </div>
              <p className="text-[11px] text-slate-400">High-risk actions subject to audit logging</p>
            </div>
          </div>

          {/* Elevated Risks & Alerts */}
          {simulationResult.sensitiveFlags.length > 0 && (
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Elevated Security Capabilities Detected
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {simulationResult.sensitiveFlags.map((flag) => (
                  <div
                    key={flag.permission}
                    className="p-2.5 bg-white/90 rounded-xl border border-amber-200/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{flag.label}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700">
                        {flag.risk}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{flag.warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accessible UI Modules Grid */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              Permitted Frontend Navigation &amp; Workspaces
            </h3>
            <div className="flex flex-wrap gap-2">
              {simulationResult.accessibleModules.map((mod) => (
                <span
                  key={mod}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {mod}
                </span>
              ))}
            </div>
          </div>

          {/* Granular Capabilities Breakdown */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              Authorized Server Operations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
              {simulationResult.activePermissions.map((perm) => (
                <div
                  key={perm.key}
                  className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-[11px]">{perm.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        perm.risk === 'critical'
                          ? 'bg-rose-50 text-rose-700'
                          : perm.risk === 'sensitive'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {perm.risk}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{perm.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty Prompt */
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Ready to Simulate Access Policy</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Select a staff member or role template above and run simulation to preview authorized actions, navigation visibility, and security boundaries.
          </p>
        </div>
      )}
    </div>
  );
}
