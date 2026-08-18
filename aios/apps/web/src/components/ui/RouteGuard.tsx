'use client';

// ─── RouteGuard ───────────────────────────────────────────────────────────────
// Protects dashboard routes by role.
// Redirects unauthenticated users to /login.
// Redirects users with wrong role to /login?reason=unauthorized.
// Shows a skeleton while auth state is loading.
//
// Usage (in dashboard/teacher/page.tsx):
//   <RouteGuard allowedRoles={['TEACHER']}>
//     <TeacherDashboard />
//   </RouteGuard>

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import type { UserRole } from '@/types/db.types';

interface RouteGuardProps {
  allowedRoles: UserRole[];
  children:     ReactNode;
}

export function RouteGuard({ allowedRoles, children }: RouteGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      router.replace('/login?reason=unauthorized');
    }
  }, [user, isLoading, allowedRoles]);

  if (isLoading) return <FullPageSkeleton />;
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}

// ─── FullPageSkeleton ─────────────────────────────────────────────────────────
export function FullPageSkeleton() {
  return (
    <div className="flex h-screen w-full bg-white animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-64 h-full bg-slate-100 border-r border-slate-200 flex flex-col gap-4 p-5">
        <div className="h-8 w-36 bg-slate-200 rounded-xl" />
        <div className="h-4 w-24 bg-slate-200 rounded-lg mt-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-full bg-slate-200 rounded-xl" />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col gap-6 p-8">
        <div className="h-8 w-64 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-slate-100 rounded-2xl" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
