'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  Loader2,
  AlertTriangle,
  Info,
  Shield,
  Layers,
  FileText,
  ClipboardList,
  Star,
  Clock,
  Users,
  Briefcase,
  BarChart2,
  ArrowRight,
  Sparkles,
  BookOpen,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react';
import {
  useRolesAndPermissions,
  usePermissionGrants,
  useSyncUserPermissions,
  useTeachers,
  useBatches,
  useSubjects,
} from '@/hooks/useApi';
import { AppleDropdown, type AppleDropdownOption } from '@/components/ui/AppleDropdown';
import { AppleMultiSelectDropdown, type MultiSelectOption } from '@/components/ui/AppleMultiSelectDropdown';
import { ConfirmDialog } from '@/components/ui/foundation';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  academics: Layers,
  questions: FileText,
  exams: ClipboardList,
  evaluations: Star,
  attendance: Clock,
  students: Users,
  staff: Briefcase,
  reports: BarChart2,
  governance: Shield,
};

export function PermissionEditorView() {
  const { data: rolesData, isLoading: rolesLoading } = useRolesAndPermissions();
  const { data: grants, isLoading: grantsLoading } = usePermissionGrants();
  const { data: teachersResp, isLoading: teachersLoading } = useTeachers();
  const { data: batchesResp } = useBatches();
  const { data: subjectsResp } = useSubjects();

  const syncMutation = useSyncUserPermissions();

  const teachers = (teachersResp?.data ?? []).filter((t: any) => !!t.user?.id);
  const batches: { id: string; name: string }[] = batchesResp?.data ?? batchesResp ?? [];
  const subjects: { id: string; name: string }[] = subjectsResp ?? [];

  const canonicalPerms = rolesData?.canonicalPermissions ?? [];
  const categories = rolesData?.categories ?? [];
  const templates = rolesData?.templates ?? [];

  // Selected User & Scope
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [scopeBatchIds, setScopeBatchIds] = useState<string[]>([]);
  const [scopeSubjectIds, setScopeSubjectIds] = useState<string[]>([]);

  // Local permissions set (user's working draft)
  const [draftGrants, setDraftGrants] = useState<{ permission: string; batchId?: string; subjectId?: string }[]>([]);
  const [initialGrants, setInitialGrants] = useState<{ permission: string; batchId?: string; subjectId?: string }[]>([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<'ALL' | 'standard' | 'sensitive' | 'critical'>('ALL');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Sync draft whenever user selection changes or grants reload
  useEffect(() => {
    if (!selectedUserId) {
      setDraftGrants([]);
      setInitialGrants([]);
      return;
    }

    const userGrants = (grants ?? [])
      .filter((g) => g.userId === selectedUserId)
      .map((g) => ({
        permission: g.permission,
        batchId: g.batchId ?? undefined,
        subjectId: g.subjectId ?? undefined,
      }));

    setDraftGrants(userGrants);
    setInitialGrants(userGrants);
  }, [selectedUserId, grants]);

  // Compute Diff
  const draftPermKeys = useMemo(() => new Set(draftGrants.map((g) => g.permission)), [draftGrants]);
  const initialPermKeys = useMemo(() => new Set(initialGrants.map((g) => g.permission)), [initialGrants]);

  const addedPermissions = useMemo(
    () => Array.from(draftPermKeys).filter((k) => !initialPermKeys.has(k)),
    [draftPermKeys, initialPermKeys],
  );

  const removedPermissions = useMemo(
    () => Array.from(initialPermKeys).filter((k) => !draftPermKeys.has(k)),
    [draftPermKeys, initialPermKeys],
  );

  const isDirty = addedPermissions.length > 0 || removedPermissions.length > 0;

  // Helper to construct scope permutations
  const createScopedGrants = (permissionKey: string) => {
    if (scopeBatchIds.length === 0 && scopeSubjectIds.length === 0) {
      return [{ permission: permissionKey }];
    }
    if (scopeBatchIds.length > 0 && scopeSubjectIds.length === 0) {
      return scopeBatchIds.map((bId) => ({ permission: permissionKey, batchId: bId }));
    }
    if (scopeBatchIds.length === 0 && scopeSubjectIds.length > 0) {
      return scopeSubjectIds.map((sId) => ({ permission: permissionKey, subjectId: sId }));
    }
    const result: { permission: string; batchId?: string; subjectId?: string }[] = [];
    for (const bId of scopeBatchIds) {
      for (const sId of scopeSubjectIds) {
        result.push({ permission: permissionKey, batchId: bId, subjectId: sId });
      }
    }
    return result;
  };

  // Toggle single permission
  const handleTogglePermission = (permissionKey: string) => {
    if (draftPermKeys.has(permissionKey)) {
      setDraftGrants((prev) => prev.filter((g) => g.permission !== permissionKey));
    } else {
      setDraftGrants((prev) => [...prev, ...createScopedGrants(permissionKey)]);
    }
  };

  // Category select/clear
  const handleSelectAllCategory = (catId: string) => {
    const catPerms = canonicalPerms.filter((p) => p.category === catId);
    const catKeys = new Set(catPerms.map((p) => p.key));
    const newGrants = draftGrants.filter((g) => !catKeys.has(g.permission));

    catPerms.forEach((p) => {
      newGrants.push(...createScopedGrants(p.key));
    });

    setDraftGrants(newGrants);
  };

  const handleClearCategory = (catId: string) => {
    const catPerms = canonicalPerms.filter((p) => p.category === catId);
    const catKeys = new Set(catPerms.map((p) => p.key));
    setDraftGrants((prev) => prev.filter((g) => !catKeys.has(g.permission)));
  };

  // Apply Role Template Preset
  const handleApplyTemplate = (tpl: any) => {
    const newGrants: { permission: string; batchId?: string; subjectId?: string }[] = [];
    tpl.permissions.forEach((p: string) => {
      newGrants.push(...createScopedGrants(p));
    });
    setDraftGrants(newGrants);
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedUserId || !isDirty) return;
    await syncMutation.mutateAsync({
      userId: selectedUserId,
      grants: draftGrants,
    });
    setInitialGrants([...draftGrants]);
  };

  // Discard changes
  const handleDiscard = () => {
    setDraftGrants([...initialGrants]);
    setShowDiscardDialog(false);
  };

  const teacherDropdownOptions: AppleDropdownOption[] = teachers.map((t: any) => ({
    value: t.user.id,
    label: t.user.name,
    sublabel: t.user.email,
    badge: t.user.role,
  }));

  const batchMultiOptions: MultiSelectOption[] = batches.map((b: any) => ({
    value: b.id,
    label: b.name,
    sublabel: [b.classYear, b.section].filter(Boolean).join(' · ') || undefined,
  }));

  const subjectMultiOptions: MultiSelectOption[] = subjects.map((s) => ({
    value: s.id,
    label: s.name,
    badge: (s as any).code || undefined,
  }));

  const selectedTeacher = teachers.find((t: any) => t.user.id === selectedUserId);
  const teacherBatches = selectedTeacher?.batchAssignments ?? [];
  const teacherSubjects = subjects.filter((s) => (selectedTeacher?.subjectIds ?? []).includes(s.id));

  const filteredCategories = useMemo(() => {
    return categories.map((cat) => {
      const catPerms = canonicalPerms.filter((p) => {
        if (p.category !== cat.id) return false;
        if (selectedRisk !== 'ALL' && p.risk !== selectedRisk) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
        }
        return true;
      });
      return {
        ...cat,
        items: catPerms,
      };
    }).filter((cat) => cat.items.length > 0);
  }, [categories, canonicalPerms, selectedRisk, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── User & Scope Selector Card ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              Fine-Grained Permission Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a staff member to view and edit their direct, role-based, or scoped capabilities.
            </p>
          </div>
          {selectedTeacher && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                {draftGrants.length} active capabilities
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Staff Member *
            </label>
            <AppleDropdown
              value={selectedUserId}
              onChange={setSelectedUserId}
              options={teacherDropdownOptions}
              placeholder="Select teacher or admin…"
              searchable
              disabled={teachersLoading}
            />
          </div>

          <div>
            <AppleMultiSelectDropdown
              label="Scope to Batches"
              values={scopeBatchIds}
              onChange={setScopeBatchIds}
              options={batchMultiOptions}
              allOptionLabel="Institute-wide (All Batches)"
              placeholder="Select batches…"
              quickAction={
                teacherBatches.length > 0
                  ? {
                      label: `Select Assigned (${teacherBatches.length})`,
                      onClick: () => setScopeBatchIds(teacherBatches.map((b: any) => b.batchId)),
                    }
                  : undefined
              }
            />
          </div>

          <div>
            <AppleMultiSelectDropdown
              label="Scope to Subjects"
              values={scopeSubjectIds}
              onChange={setScopeSubjectIds}
              options={subjectMultiOptions}
              allOptionLabel="All Subjects"
              placeholder="Select subjects…"
              quickAction={
                teacherSubjects.length > 0
                  ? {
                      label: `Select Teaching (${teacherSubjects.length})`,
                      onClick: () => setScopeSubjectIds(teacherSubjects.map((s) => s.id)),
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {/* ── Active Staff Context Card ─────────────────────────────────── */}
        {selectedTeacher && (
          <div className="bg-gradient-to-r from-slate-50 via-indigo-50/20 to-white rounded-2xl border border-indigo-100/80 p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-indigo-100/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs shadow-indigo-200">
                  {selectedTeacher.user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900">{selectedTeacher.user.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      {selectedTeacher.user.role}
                    </span>
                    {selectedTeacher.qualification && (
                      <span className="text-[10.5px] text-slate-400">
                        • {selectedTeacher.qualification}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{selectedTeacher.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Routine Classroom Access Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Assigned Batches */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-indigo-500" /> Currently Assigned Batches ({teacherBatches.length})
                </p>
                {teacherBatches.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Not assigned to any batch yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {teacherBatches.map((tb: any) => {
                      const bName = tb.batch?.name || tb.batchName || batches.find((b) => b.id === tb.batchId)?.name || 'Batch';
                      return (
                        <span
                          key={tb.id || tb.batchId}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs flex items-center gap-1"
                        >
                          <Layers className="w-2.5 h-2.5 text-indigo-500" />
                          {bName}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Teaching Subjects */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-emerald-500" /> Teaching Subjects ({teacherSubjects.length})
                </p>
                {teacherSubjects.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No qualified subjects assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {teacherSubjects.map((sub) => (
                      <span
                        key={sub.id}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs flex items-center gap-1"
                      >
                        <BookOpen className="w-2.5 h-2.5 text-emerald-500" />
                        {sub.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Explanatory callout */}
            <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Standard classroom duties (marking attendance, grading student submissions, tests) are automatically enabled for this teacher's assigned batches. Use this matrix only to grant <strong>elevated powers</strong> (e.g. HOD review, locked exam overrides, cross-class delegation).
              </span>
            </div>
          </div>
        )}

        {/* Template Quick Presets Bar */}
        {selectedUserId && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Apply Template Preset:
            </span>
            {templates.slice(0, 5).map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                className="px-2.5 py-1 rounded-lg font-medium text-[11px] bg-slate-100/80 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent transition-all cursor-pointer"
              >
                {tpl.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Search, Risk Filter & Stats Bar ─────────────────────────────── */}
      {selectedUserId ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search capabilities by name, action, or module…"
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Risk:</span>
              {(['ALL', 'standard', 'sensitive', 'critical'] as const).map((risk) => (
                <button
                  key={risk}
                  onClick={() => setSelectedRisk(risk)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                    selectedRisk === risk
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {risk.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* ── Categorized Accordion Groups ──────────────────────────────── */}
          <div className="space-y-3.5">
            {filteredCategories.map((cat) => {
              const isCollapsed = !!collapsedCategories[cat.id];
              const CatIcon = CATEGORY_ICONS[cat.id] ?? Shield;
              const catActiveCount = cat.items.filter((p) => draftPermKeys.has(p.key)).length;

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
                >
                  {/* Category Header */}
                  <div
                    onClick={() =>
                      setCollapsedCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                    }
                    className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50/90 cursor-pointer border-b border-slate-100 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shadow-2xs">
                        <CatIcon className="w-4 h-4 text-slate-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900">{cat.label}</h3>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                              catActiveCount > 0
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {catActiveCount} / {cat.items.length} enabled
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{cat.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleSelectAllCategory(cat.id)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleClearCategory(cat.id)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() =>
                          setCollapsedCategories((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                        }
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 ml-2"
                      >
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  {!isCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 divide-slate-100">
                      {cat.items.map((perm) => {
                        const isEnabled = draftPermKeys.has(perm.key);
                        const isAdded = addedPermissions.includes(perm.key);
                        const isRemoved = removedPermissions.includes(perm.key);

                        return (
                          <div
                            key={perm.key}
                            onClick={() => handleTogglePermission(perm.key)}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isEnabled
                                ? 'bg-indigo-50/30 border-indigo-200/80 shadow-2xs'
                                : 'bg-white border-slate-200/70 hover:border-slate-300'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className="pt-0.5">
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                                  isEnabled
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isEnabled && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>

                            {/* Label & Details */}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  {perm.label}
                                  {isAdded && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      +Added
                                    </span>
                                  )}
                                  {isRemoved && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      -Removed
                                    </span>
                                  )}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      perm.key === 'exam:unlock' || perm.key === 'REVIEW_EVALUATION'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                                    }`}
                                  >
                                    {perm.key === 'exam:unlock' || perm.key === 'REVIEW_EVALUATION' ? 'Runtime Guard' : 'Role RBAC'}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      perm.risk === 'critical'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : perm.risk === 'sensitive'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {perm.risk}
                                  </span>
                                </div>
                              </div>

                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                {perm.description}
                              </p>

                              {perm.key === 'exam:unlock' && (
                                <p className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5">
                                  <Shield className="w-3 h-3 text-indigo-500" />
                                  Dynamic gate: enables emergency exam unlocking with mandatory audit log
                                </p>
                              )}

                              {perm.key === 'REVIEW_EVALUATION' && (
                                <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  Reviewer grant: allows score overrides with dispute reasoning
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Staff Member Selected</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Choose a teacher or administrator from the selector above to inspect and adjust their fine-grained access policies.
          </p>
        </div>
      )}

      {/* ── Sticky Unsaved Changes Floating Bar ─────────────────────────── */}
      {selectedUserId && isDirty && (
        <div className="sticky bottom-4 z-40 bg-slate-900 text-white p-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-fadein">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold">
              Unsaved changes:{' '}
              {addedPermissions.length > 0 && <span className="text-emerald-400">+{addedPermissions.length} added</span>}
              {addedPermissions.length > 0 && removedPermissions.length > 0 && <span>, </span>}
              {removedPermissions.length > 0 && <span className="text-rose-400">-{removedPermissions.length} removed</span>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiffModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
            >
              Compare Diff
            </button>
            <button
              onClick={() => setShowDiscardDialog(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:scale-98 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Policies
            </button>
          </div>
        </div>
      )}

      {/* ── Diff Modal ─────────────────────────────────────────────────── */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadein">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Policy Changes Comparison</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
              {addedPermissions.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 space-y-1.5">
                  <span className="font-bold text-emerald-800">Capabilities to be Added ({addedPermissions.length})</span>
                  <div className="flex flex-wrap gap-1">
                    {addedPermissions.map((k) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium text-[10px]">
                        +{k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {removedPermissions.length > 0 && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200/60 space-y-1.5">
                  <span className="font-bold text-rose-800">Capabilities to be Revoked ({removedPermissions.length})</span>
                  <div className="flex flex-wrap gap-1">
                    {removedPermissions.map((k) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium text-[10px]">
                        -{k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDiffModal(false);
                  handleSave();
                }}
                disabled={syncMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
              >
                Confirm &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Discard Confirmation Dialog ─────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showDiscardDialog}
        title="Discard Unsaved Changes?"
        description="All changes made to this user's permissions during this editing session will be lost."
        confirmLabel="Discard"
        variant="warning"
        onConfirm={handleDiscard}
        onCancel={() => setShowDiscardDialog(false)}
      />
    </div>
  );
}
