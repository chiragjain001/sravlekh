'use client';

// ─── Foundation UI Components ─────────────────────────────────────────────────
// Skeleton primitives, OfflineBanner, ConfirmDialog, EmptyState

import { type ReactNode } from 'react';
import { AlertTriangle as WarnIcon, WifiOff, Loader2, X, RefreshCw } from 'lucide-react';
import { useUIStore } from '@/store/ui-stores';

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ── Base skeleton pulse ───────────────────────────────────────────────────────
function Pulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-slate-100 rounded-xl', className)} />;
}

// ── Text line skeleton ────────────────────────────────────────────────────────
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse key={i} className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  );
}

// ── KPI Card skeleton ─────────────────────────────────────────────────────────
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-5 border border-slate-100 rounded-2xl space-y-3', className)}>
      <Pulse className="h-3 w-24" />
      <Pulse className="h-8 w-16" />
      <Pulse className="h-3 w-20" />
    </div>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ── Batch card skeleton ───────────────────────────────────────────────────────
export function BatchCardSkeleton() {
  return (
    <div className="p-5 border border-slate-100 rounded-2xl space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Pulse className="h-6 w-16" />
        <Pulse className="h-5 w-24 rounded-full" />
      </div>
      <Pulse className="h-4 w-28" />
      <Pulse className="h-2 w-full rounded-full" />
      <div className="flex gap-2">
        <Pulse className="h-8 flex-1 rounded-xl" />
        <Pulse className="h-8 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

export function BatchCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => <BatchCardSkeleton key={i} />)}
    </div>
  );
}

// ── Student list skeleton ─────────────────────────────────────────────────────
export function StudentRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
      <Pulse className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-3.5 w-36" />
        <Pulse className="h-3 w-24" />
      </div>
      <Pulse className="h-6 w-12 rounded-full" />
      <Pulse className="h-6 w-10 rounded-lg" />
    </div>
  );
}

export function StudentListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
      {Array.from({ length: count }).map((_, i) => <StudentRowSkeleton key={i} />)}
    </div>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <div className="flex gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => <Pulse key={i} className="h-3.5 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-4 px-5 py-4 border-b border-slate-50">
          {Array.from({ length: cols }).map((_, ci) => (
            <Pulse key={ci} className={cn('h-4 flex-1', ci === 0 ? 'w-1/3' : '')} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── OfflineBanner ────────────────────────────────────────────────────────────
export function OfflineBanner() {
  const isOnline   = useUIStore(s => s.isOnline);
  const queueCount = useUIStore(s => s.offlineQueueCount);

  if (isOnline && queueCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-rose-600 text-white text-[12.5px] font-bold py-2 px-4 shadow-lg">
        <WifiOff className="w-4 h-4" />
        <span>No internet connection — your work is saved locally</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-amber-500 text-white text-[12.5px] font-bold py-2 px-4 shadow-lg">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Syncing {queueCount} offline {queueCount === 1 ? 'action' : 'actions'}...</span>
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  isOpen:        boolean;
  title:         string;
  description:   string;
  confirmLabel?: string;
  variant?:      'danger' | 'warning';
  isLoading?:    boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export function ConfirmDialog({
  isOpen, title, description, confirmLabel = 'Confirm',
  variant = 'danger', isLoading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;
  const isDanger = variant === 'danger';
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-rose-50' : 'bg-amber-50'}`}>
              <WarnIcon className={`w-5 h-5 ${isDanger ? 'text-rose-500' : 'text-amber-500'}`} />
            </div>
            <h3 className="text-[16px] font-bold text-slate-800">{title}</h3>
          </div>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[13px] text-slate-600 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-[13px] font-bold text-white rounded-xl transition-colors flex items-center gap-2 ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400' : 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  action?:      { label: string; onClick: () => void };
  className?:   string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-8 gap-4', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[15px] font-bold text-slate-700">{title}</p>
        {description && <p className="text-[13px] text-slate-500">{description}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} className="mt-2 px-5 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}
