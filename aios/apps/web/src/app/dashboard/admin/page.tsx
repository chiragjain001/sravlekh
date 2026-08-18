'use client';

import { useAuth } from '@/contexts/auth.context';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopHeader } from '@/components/shared/TopHeader';
import { useAdminStore } from '@/store/role-stores';
import { adminData as d } from '@/lib/mock-data/admin';
import { Suspense } from 'react';

// Foundation components
import { RouteGuard, FullPageSkeleton } from '@/components/ui/RouteGuard';
import { PageErrorBoundary }            from '@/components/ui/ErrorBoundary';
import { OfflineBanner }                from '@/components/ui/foundation';

// Screens
import { AdminOverview }      from '@/components/dashboard/admin/screens/AdminOverview';
import { AdminTeachers }      from '@/components/dashboard/admin/screens/AdminTeachers';
import { AdminStudents }      from '@/components/dashboard/admin/screens/AdminStudents';
import { AdminBatches }       from '@/components/dashboard/admin/screens/AdminBatches';
import { AdminAcademics }     from '@/components/dashboard/admin/screens/AdminAcademics';
import { AdminExams }         from '@/components/dashboard/admin/screens/AdminExams';
import { AdminTimetable }     from '@/components/dashboard/admin/screens/AdminTimetable';
import { AdminAttendance }    from '@/components/dashboard/admin/screens/AdminAttendance';
import { AdminCommunication } from '@/components/dashboard/admin/screens/AdminCommunication';
import { AdminReports }       from '@/components/dashboard/admin/screens/AdminReports';
import { AdminSystemSettings }from '@/components/dashboard/admin/screens/AdminSystemSettings';
import { AdminAuditLogs }     from '@/components/dashboard/admin/screens/AdminAuditLogs';
import { AdminAnalytics }     from '@/components/dashboard/admin/screens/AdminAnalytics';

import { ChevronDown, MapPin, CalendarDays } from 'lucide-react';

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

function AdminDashboardInner() {
  const { user, logout } = useAuth();
  const { adminNav, setAdminNav } = useAdminStore();
  const { canGoBack, previousNav, goBack } = useNavigationHistory('admin');

  const renderScreen = () => {
    switch (adminNav) {
      case 'Dashboard':       return <AdminOverview />;
      case 'Teachers':        return <AdminTeachers />;
      case 'Students':        return <AdminStudents />;
      case 'Batches':         return <AdminBatches />;
      case 'Academics':       return <AdminAcademics />;
      case 'Exams':           return <AdminExams />;
      case 'Timetable':       return <AdminTimetable />;
      case 'Attendance':      return <AdminAttendance />;
      case 'Communication':   return <AdminCommunication />;
      case 'Reports':         return <AdminReports />;
      case 'System Settings': return <AdminSystemSettings />;
      case 'Settings':        return <AdminSystemSettings />;
      case 'Audit Logs':      return <AdminAuditLogs />;
      case 'Analytics':       return <AdminAnalytics />;
      default:
        return (
          <div className="flex items-center justify-center h-[50vh] text-slate-400 animate-fadein">
            <p>Section "{adminNav}" is under construction.</p>
          </div>
        );
    }
  };

  const adminName = user?.name ?? d.user.name;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <OfflineBanner />

      <Sidebar
        role="ADMIN"
        userName={adminName}
        designation={d.user.designation}
        avatarInitials={user?.avatarInitials ?? d.user.avatarInitials}
        navItems={d.navItems}
        activeNav={adminNav}
        onNavChange={(nav) => setAdminNav(nav as any)}
        onLogout={logout}
      />

      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col bg-[#f8fafc]">
        <TopHeader
          greeting={adminNav === 'Dashboard' ? `Welcome back, ${adminName.split(' ')[0]}! ☀️` : adminNav}
          subtitle={adminNav === 'Dashboard' ? "Here's an overview of your institute." : `Manage your institute ${adminNav.toLowerCase()}`}
          showDate={adminNav === 'Dashboard'}
          dateStr={d.user.today}
          rightContent={
            <div className="flex items-center gap-3 mr-2">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[12px] font-bold text-slate-700">South Delhi Branch</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[12px] font-bold text-slate-700">Session 2026-27</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          }
        />

        <div className="flex-1 min-w-0">
          <PageErrorBoundary>
            {renderScreen()}
          </PageErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN', 'FOUNDER', 'ACADEMIC_HEAD']}>
      <Suspense fallback={<FullPageSkeleton />}>
        <AdminDashboardInner />
      </Suspense>
    </RouteGuard>
  );
}
