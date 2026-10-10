'use client';

import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Copy,
  Edit2,
  Trash2,
  UserCheck,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Layers,
  FileText,
  ClipboardList,
  Star,
  Clock,
  Users,
  Briefcase,
  BarChart2,
  CheckCircle2,
} from 'lucide-react';
import {
  useRolesAndPermissions,
  useCreateCustomRole,
  useUpdateCustomRole,
  useDeleteCustomRole,
  useDuplicateRole,
  useAssignRoleToUser,
  useTeachers,
  useBatches,
  useSubjects,
} from '@/hooks/useApi';
import { AppleDropdown, type AppleDropdownOption } from '@/components/ui/AppleDropdown';
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

export function RoleTemplatesView() {
  const { data: rolesData, isLoading } = useRolesAndPermissions();
  const { data: teachersResp } = useTeachers();
  const { data: batchesResp } = useBatches();
  const { data: subjectsResp } = useSubjects();

  const createRoleMutation = useCreateCustomRole();
  const updateRoleMutation = useUpdateCustomRole();
  const deleteRoleMutation = useDeleteCustomRole();
  const duplicateRoleMutation = useDuplicateRole();
  const assignRoleMutation = useAssignRoleToUser();

  const [expandedRoleIds, setExpandedRoleIds] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [assigningRole, setAssigningRole] = useState<any | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null);

  // Form states for Create/Edit Custom Role
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBaseRole, setFormBaseRole] = useState('TEACHER');
  const [formScope, setFormScope] = useState<'INSTITUTE' | 'BATCH' | 'SUBJECT'>('INSTITUTE');
  const [formSelectedPerms, setFormSelectedPerms] = useState<string[]>([]);

  // Form states for Assign Role
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignBatchId, setAssignBatchId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');

  const teachers = (teachersResp?.data ?? []).filter((t: any) => !!t.user?.id);
  const batches: { id: string; name: string }[] = batchesResp?.data ?? batchesResp ?? [];
  const subjects: { id: string; name: string }[] = subjectsResp ?? [];

  const templates = rolesData?.templates ?? [];
  const canonicalPerms = rolesData?.canonicalPermissions ?? [];
  const categories = rolesData?.categories ?? [];

  const toggleExpand = (id: string) => {
    setExpandedRoleIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateModal = () => {
    setFormName('');
    setFormDesc('');
    setFormBaseRole('TEACHER');
    setFormScope('INSTITUTE');
    setFormSelectedPerms([]);
    setEditingRole(null);
    setShowCreateModal(true);
  };

  const openEditModal = (role: any) => {
    setFormName(role.name);
    setFormDesc(role.description);
    setFormBaseRole(role.baseRole);
    setFormScope(role.defaultScope);
    setFormSelectedPerms([...role.permissions]);
    setEditingRole(role);
    setShowCreateModal(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingRole) {
      await updateRoleMutation.mutateAsync({
        roleId: editingRole.id,
        data: {
          name: formName.trim(),
          description: formDesc.trim(),
          permissions: formSelectedPerms,
          defaultScope: formScope,
        },
      });
    } else {
      await createRoleMutation.mutateAsync({
        name: formName.trim(),
        description: formDesc.trim(),
        baseRole: formBaseRole,
        permissions: formSelectedPerms,
        defaultScope: formScope,
      });
    }
    setShowCreateModal(false);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningRole || !assignTeacherId) return;

    await assignRoleMutation.mutateAsync({
      roleId: assigningRole.id,
      userId: assignTeacherId,
      batchId: assignBatchId || undefined,
      subjectId: assignSubjectId || undefined,
    });
    setAssigningRole(null);
    setAssignTeacherId('');
    setAssignBatchId('');
    setAssignSubjectId('');
  };

  const teacherDropdownOptions: AppleDropdownOption[] = teachers.map((t: any) => ({
    value: t.user.id,
    label: t.user.name,
    sublabel: t.user.email,
    badge: t.user.role,
  }));

  const batchDropdownOptions: AppleDropdownOption[] = [
    { value: '', label: 'Institute-wide (All Batches)' },
    ...batches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const subjectDropdownOptions: AppleDropdownOption[] = [
    { value: '', label: 'All Subjects' },
    ...subjects.map((s) => ({ value: s.id, label: s.name })),
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-slate-100 rounded-2xl border border-slate-200/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Action Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Educational Role Templates &amp; Custom Roles
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pre-configured capability bundles for academic positions. Assign to faculty or customize for your institute.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Custom Role
        </button>
      </div>

      {/* ── Role Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((role) => {
          const isExpanded = !!expandedRoleIds[role.id];
          const isSystem = role.isSystem;

          return (
            <div
              key={role.id}
              className="group flex flex-col justify-between bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="p-5 space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {role.name}
                      </h3>
                      {isSystem ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60" title="Protected System Template">
                          <Lock className="w-2.5 h-2.5 text-slate-400" /> System
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {role.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {role.baseRole}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {role.userCount ?? 0} {role.userCount === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                </div>

                {/* Scope & Permissions Metric */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                  <span className="font-medium text-slate-600">Default Scope:</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200/50">
                    {role.defaultScope === 'INSTITUTE'
                      ? 'Institute-wide'
                      : role.defaultScope === 'BATCH'
                      ? 'Batch-scoped'
                      : 'Subject-scoped'}
                  </span>
                  <span className="ml-auto font-semibold text-slate-700">
                    {role.permissions.length} capabilities
                  </span>
                </div>

                {/* Capabilities Badges Preview */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {(isExpanded ? role.permissions : role.permissions.slice(0, 4)).map((permKey) => {
                      const def = canonicalPerms.find((p) => p.key === permKey);
                      return (
                        <span
                          key={permKey}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100/80 text-slate-700 hover:bg-slate-200/70 transition-colors"
                          title={def?.description ?? permKey}
                        >
                          {def?.label ?? permKey}
                        </span>
                      );
                    })}
                  </div>
                  {role.permissions.length > 4 && (
                    <button
                      onClick={() => toggleExpand(role.id)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 pt-0.5 cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> +{role.permissions.length - 4} more capabilities
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setAssigningRole(role)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:scale-98 transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Assign to Staff
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateRoleMutation.mutate(role.id)}
                    disabled={duplicateRoleMutation.isPending}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                    title="Duplicate as template"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {!isSystem && (
                    <>
                      <button
                        onClick={() => openEditModal(role)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                        title="Edit custom role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRoleToDelete(role)}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Delete custom role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Create / Edit Role Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadein">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Educational Role'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Science Lab Coordinator, Discipline Head"
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Brief summary of duties and responsibilities"
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base User Role</label>
                  <select
                    value={formBaseRole}
                    onChange={(e) => setFormBaseRole(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="TEACHER">TEACHER (Faculty member)</option>
                    <option value="ADMIN">ADMIN (Administrative staff)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="INSTITUTE">Institute-wide</option>
                    <option value="BATCH">Batch-scoped</option>
                    <option value="SUBJECT">Subject-scoped</option>
                  </select>
                </div>
              </div>

              {/* Permissions Checklist by Category */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800">
                    Granted Capabilities ({formSelectedPerms.length} selected)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormSelectedPerms(canonicalPerms.map((p) => p.key))}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFormSelectedPerms([])}
                      className="text-[11px] font-semibold text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const catPerms = canonicalPerms.filter((p) => p.category === cat.id);
                    const CatIcon = CATEGORY_ICONS[cat.id] ?? Shield;

                    return (
                      <div key={cat.id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <CatIcon className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-xs font-bold text-slate-800">{cat.label}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catPerms.map((perm) => {
                            const isSelected = formSelectedPerms.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-500/10'
                                    : 'bg-white/60 border-slate-200/70 hover:bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormSelectedPerms((prev) => [...prev, perm.key]);
                                    } else {
                                      setFormSelectedPerms((prev) => prev.filter((k) => k !== perm.key));
                                    }
                                  }}
                                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-800 text-[11px]">{perm.label}</span>
                                    {perm.risk === 'critical' && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-600">
                                        Critical
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 line-clamp-1">{perm.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-60"
                >
                  {(createRoleMutation.isPending || updateRoleMutation.isPending) && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Role to Staff Modal ──────────────────────────────────── */}
      {assigningRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadein">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Assign Role to Staff Member</h3>
                <p className="text-xs text-indigo-600 font-medium">Role: {assigningRole.name}</p>
              </div>
              <button
                onClick={() => setAssigningRole(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Staff Member *</label>
                <AppleDropdown
                  value={assignTeacherId}
                  onChange={setAssignTeacherId}
                  options={teacherDropdownOptions}
                  placeholder="Choose teacher or admin…"
                  searchable
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Scope to Batch (Optional)</label>
                <AppleDropdown
                  value={assignBatchId}
                  onChange={setAssignBatchId}
                  options={batchDropdownOptions}
                  placeholder="Institute-wide"
                  searchable
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Scope to Subject (Optional)</label>
                <AppleDropdown
                  value={assignSubjectId}
                  onChange={setAssignSubjectId}
                  options={subjectDropdownOptions}
                  placeholder="All Subjects"
                  searchable
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  Grant Overview
                </div>
                <p>
                  Will grant <strong>{assigningRole.permissions.length} capabilities</strong> associated with this role to the selected user.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningRole(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!assignTeacherId || assignRoleMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {assignRoleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Custom Role Dialog ───────────────────────────── */}
      <ConfirmDialog
        isOpen={!!roleToDelete}
        title="Delete Custom Role?"
        description={`Are you sure you want to delete "${roleToDelete?.name}"? Existing individual grants already issued to users will not be immediately stripped, but the template will no longer be available for assignment.`}
        confirmLabel="Delete Role"
        variant="danger"
        isLoading={deleteRoleMutation.isPending}
        onConfirm={async () => {
          if (roleToDelete) {
            await deleteRoleMutation.mutateAsync(roleToDelete.id);
            setRoleToDelete(null);
          }
        }}
        onCancel={() => setRoleToDelete(null)}
      />
    </div>
  );
}
