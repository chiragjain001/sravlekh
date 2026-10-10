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
import { OfflineBanner, ScreenLoadingState } from '@/components/ui/foundation';

import dynamic from 'next/dynamic';

// Screens — AdminOverview is eager (landing tab), others are code-split
import { AdminOverview }      from '@/components/dashboard/admin/screens/AdminOverview';

const AdminScreenLoader = () => (
  <ScreenLoadingState
    title="Loading Admin Console..."
    subtitle="Fetching institute records and configurations from server..."
    layout="table"
  />
);

const AdminTeachers = dynamic(() => import('@/components/dashboard/admin/screens/AdminTeachers').then((m) => m.AdminTeachers), { loading: AdminScreenLoader });
const AdminStudents = dynamic(() => import('@/components/dashboard/admin/screens/AdminStudents').then((m) => m.AdminStudents), { loading: AdminScreenLoader });
const AdminBatches = dynamic(() => import('@/components/dashboard/admin/screens/AdminBatches').then((m) => m.AdminBatches), { loading: AdminScreenLoader });
const AdminExams = dynamic(() => import('@/components/dashboard/admin/screens/AdminExams').then((m) => m.AdminExams), { loading: AdminScreenLoader });
const DoubtsList = dynamic(() => import('@/components/dashboard/admin/doubts/DoubtsList').then((m) => m.DoubtsList), { loading: AdminScreenLoader });
const AssignmentsList = dynamic(() => import('@/components/dashboard/admin/assignments/AssignmentsList').then((m) => m.AssignmentsList), { loading: AdminScreenLoader });
const AdminTimetable = dynamic(() => import('@/components/dashboard/admin/screens/AdminTimetable').then((m) => m.AdminTimetable), { loading: AdminScreenLoader });
const AdminAttendance = dynamic(() => import('@/components/dashboard/admin/screens/AdminAttendance').then((m) => m.AdminAttendance), { loading: AdminScreenLoader });
const AdminCommunication = dynamic(() => import('@/components/dashboard/admin/screens/AdminCommunication').then((m) => m.AdminCommunication), { loading: AdminScreenLoader });
const AdminReports = dynamic(() => import('@/components/dashboard/admin/screens/AdminReports').then((m) => m.AdminReports), { loading: AdminScreenLoader });
const AdminSystemSettings = dynamic(() => import('@/components/dashboard/admin/screens/AdminSystemSettings').then((m) => m.AdminSystemSettings), { loading: AdminScreenLoader });
const AdminAuditLogs = dynamic(() => import('@/components/dashboard/admin/screens/AdminAuditLogs').then((m) => m.AdminAuditLogs), { loading: AdminScreenLoader });
const AdminAnalytics = dynamic(() => import('@/components/dashboard/admin/screens/AdminAnalytics').then((m) => m.AdminAnalytics), { loading: AdminScreenLoader });
const AdminEvaluationQualityDashboard = dynamic(() => import('@/components/dashboard/admin/screens/AdminEvaluationQualityDashboard').then((m) => m.AdminEvaluationQualityDashboard), { loading: AdminScreenLoader });
const AdminAnalyticsHub = dynamic(() => import('@/components/dashboard/admin/screens/AdminAnalyticsHub').then((m) => m.AdminAnalyticsHub), { loading: AdminScreenLoader });

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

function AdminDashboardInner() {
  const { user, logout } = useAuth();
  const { adminNav, setAdminNav } = useAdminStore();
  const { canGoBack, previousNav, goBack } = useNavigationHistory('admin');

  const renderScreen = () => {
    switch (adminNav) {
      case 'Dashboard':          return <AdminOverview />;
      case 'Teachers':            return <AdminTeachers />;
      case 'Students':            return <AdminStudents />;
      case 'Batches':             return <AdminBatches />;
      case 'Exams':               return <AdminExams />;
      case 'Doubts':              return <div className="p-6"><DoubtsList /></div>;
      case 'Assignments':         return <div className="p-6"><AssignmentsList /></div>;
      case 'Timetable':           return <AdminTimetable />;
      case 'Attendance':          return <AdminAttendance />;
      case 'Communication':       return <AdminCommunication />;
      // Merged hub — primary entry point
      case 'Analytics & Reports': return <AdminAnalyticsHub />;
      // Legacy deep-link fallbacks — keep routing these so bookmarks don't break
      case 'Reports':             return <AdminReports />;
      case 'System Settings':     return <AdminSystemSettings />;
      case 'Settings':            return <AdminSystemSettings />;
      case 'Audit Logs':          return <AdminAuditLogs />;
      case 'Analytics':           return <AdminAnalytics />;
      case 'Evaluation Quality':  return <AdminEvaluationQualityDashboard />;
      default:
        return (
          <div className="flex items-center justify-center h-[50vh] text-slate-400 animate-fadein">
            <p>Section "{adminNav}" is under construction.</p>
          </div>
        );
    }
  };

  const adminName = user?.name ?? d.user.name;
  const adminDesignation = user?.role === 'FOUNDER' ? 'Founder' : 'Institute Admin';
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-bg">
      <OfflineBanner />

      <Sidebar
        role="ADMIN"
        userName={adminName}
        designation={adminDesignation}
        avatarInitials={user?.avatarInitials ?? d.user.avatarInitials}
        navItems={d.navItems}
        activeNav={adminNav}
        onNavChange={(nav) => setAdminNav(nav as any)}
        onLogout={logout}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 flex flex-col w-full max-w-full bg-[#f8fafc]" style={{ WebkitOverflowScrolling: 'touch' }}>
        <TopHeader
          greeting={adminNav === 'Dashboard' ? `Welcome back, ${adminName.split(' ')[0]}! ☀️` : adminNav}
          subtitle={adminNav === 'Dashboard' ? "Here's an overview of your institute." : `Manage your institute ${adminNav.toLowerCase()}`}
          showDate={adminNav === 'Dashboard'}
          dateStr={todayStr}
          showBackButton={canGoBack}
          previousNavLabel={previousNav}
          onBack={goBack}
        />

        <div className="flex-1 min-w-0 w-full max-w-full">
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
    <RouteGuard allowedRoles={['ADMIN', 'FOUNDER']}>
      <Suspense fallback={<FullPageSkeleton />}>
        <AdminDashboardInner />
      </Suspense>
    </RouteGuard>
  );
}
