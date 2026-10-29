'use client';

import React, { useState } from 'react';
import {
  X,
  Users,
  ShieldCheck,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import {
  useTeachers,
  useCopyCheckerAssignments,
  useAssignCopyChecker,
  useRemoveCopyChecker,
} from '@/hooks/useApi';

interface AssignEvaluatorsModalProps {
  exam: {
    id: string;
    title: string;
    batch?: { name: string };
    assessmentDeliveryId?: string | null;
  };
  onClose: () => void;
}

export function AssignEvaluatorsModal({ exam, onClose }: AssignEvaluatorsModalProps) {
  const deliveryId = exam.assessmentDeliveryId;

  const { data: teachersData, isLoading: loadingTeachers } = useTeachers();
  const { data: assignmentsData, isLoading: loadingAssignments } = useCopyCheckerAssignments(deliveryId);
  const assignMutation = useAssignCopyChecker(deliveryId);
  const removeMutation = useRemoveCopyChecker(deliveryId);

  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [scope, setScope] = useState<'BATCH' | 'STUDENT_LIST' | 'QUESTION_WISE'>('BATCH');
  const [isLeadEvaluator, setIsLeadEvaluator] = useState(false);

  const teachers = Array.isArray(teachersData)
    ? teachersData
    : (teachersData as any)?.data || [];

  const assignments = Array.isArray(assignmentsData)
    ? assignmentsData
    : (assignmentsData as any)?.data || [];

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !deliveryId) return;

    await assignMutation.mutateAsync({
      teacherProfileId: selectedTeacherId,
      scope,
      isLeadEvaluator,
    });

    setSelectedTeacherId('');
    setIsLeadEvaluator(false);
  };

  const handleRemove = async (teacherProfileId: string) => {
    if (!deliveryId) return;
    await removeMutation.mutateAsync(teacherProfileId);
  };

  const scopeLabel = (s: string) => {
    switch (s) {
      case 'BATCH':
        return 'Full Batch';
      case 'STUDENT_LIST':
        return 'Student List';
      case 'QUESTION_WISE':
        return 'Question-Wise';
      default:
        return s;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-fadein"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Assign Evaluators & Copy Checkers
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {exam.title} {exam.batch?.name ? `• ${exam.batch.name}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {!deliveryId ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Digital Delivery Sync Pending</p>
                <p className="mt-0.5 opacity-90">
                  This examination has not yet been linked to a digital assessment delivery. Advancing the exam or re-saving will provision the canonical delivery.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Add Assignment Form */}
              <form onSubmit={handleAssign} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Allocate Evaluator
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Select Teacher
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      disabled={loadingTeachers}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-hidden transition-all"
                      required
                    >
                      <option value="">-- Choose Teacher --</option>
                      {teachers.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.user?.name || t.name || 'Teacher'} ({t.user?.email || t.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Evaluation Scope
                    </label>
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-hidden transition-all"
                    >
                      <option value="BATCH">Full Batch (All answer sheets)</option>
                      <option value="STUDENT_LIST">Student List (Allocated students only)</option>
                      <option value="QUESTION_WISE">Question-Wise (Allocated questions only)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={isLeadEvaluator}
                      onChange={(e) => setIsLeadEvaluator(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span>Lead Evaluator (Has full moderation & marks finalization rights)</span>
                  </label>

                  <button
                    type="submit"
                    disabled={!selectedTeacherId || assignMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {assignMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Assign</span>
                  </button>
                </div>
              </form>

              {/* Current Assignments List */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Configured Copy Checkers ({assignments.length})
                </h3>

                {loadingAssignments ? (
                  <div className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading assignments...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-medium">No custom copy checkers configured</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      By default, all teachers assigned to this batch can evaluate. Add an evaluator above to enforce strict, role-scoped allocation.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {assignments.map((assignment: any) => {
                      const teacherName =
                        assignment.teacherProfile?.user?.name ||
                        assignment.teacherProfile?.name ||
                        'Teacher';
                      const teacherEmail =
                        assignment.teacherProfile?.user?.email ||
                        assignment.teacherProfile?.email ||
                        '';

                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                              {teacherName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                  {teacherName}
                                </span>
                                {assignment.isLeadEvaluator && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-bold text-[10px]">
                                    <ShieldCheck className="w-3 h-3" /> Lead
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {teacherEmail}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {scopeLabel(assignment.scope)}
                            </span>

                            <button
                              onClick={() => handleRemove(assignment.teacherProfileId)}
                              disabled={removeMutation.isPending}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors cursor-pointer"
                              title="Remove evaluator allocation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
