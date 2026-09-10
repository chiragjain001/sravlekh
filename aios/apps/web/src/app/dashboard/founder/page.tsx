'use client';

import { Suspense } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopHeader } from '@/components/shared/TopHeader';
import { useDashboardStore } from '@/store/dashboard-store';
import { founderData as d } from '@/lib/mock-data/founder';
import { RouteGuard, FullPageSkeleton } from '@/components/ui/RouteGuard';
import { PageErrorBoundary } from '@/components/ui/ErrorBoundary';

// Screens
import { FounderOverview } from '@/components/dashboard/founder/screens/FounderOverview';
import { FounderInstitutes } from '@/components/dashboard/founder/screens/FounderInstitutes';
import { FounderUsers } from '@/components/dashboard/founder/screens/FounderUsers';
import { FounderAnalytics } from '@/components/dashboard/founder/screens/FounderAnalytics';
import { FounderSubscriptions } from '@/components/dashboard/founder/screens/FounderSubscriptions';
import { FounderHealth } from '@/components/dashboard/founder/screens/FounderHealth';
import { FounderAuditLogs } from '@/components/dashboard/founder/screens/FounderAuditLogs';
import { FounderTickets } from '@/components/dashboard/founder/screens/FounderTickets';
import { FounderSettings } from '@/components/dashboard/founder/screens/FounderSettings';
import { FounderFeatureManagement } from '@/components/dashboard/founder/screens/FounderFeatureManagement';
import { FounderIntegrations } from '@/components/dashboard/founder/screens/FounderIntegrations';

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

function FounderDashboardInner() {
  const { logout } = useAuth();
  const { founderActiveNav, setFounderActiveNav } = useDashboardStore();
  const { canGoBack, previousNav, goBack } = useNavigationHistory('founder');

  const renderScreen = () => {
    switch (founderActiveNav) {
      case 'Overview':           return <FounderOverview />;
      case 'Institutes':         return <FounderInstitutes />;
      case 'Users':              return <FounderUsers />;
      case 'Analytics':          return <FounderAnalytics />;
      case 'Subscriptions':      return <FounderSubscriptions />;
      case 'System Health':      return <FounderHealth />;
      case 'Audit Logs':         return <FounderAuditLogs />;
      case 'Support Tickets':    return <FounderTickets />;
      case 'Settings':           return <FounderSettings />;
      case 'Feature Management': return <FounderFeatureManagement />;
      case 'Integrations':       return <FounderIntegrations />;
      default:
        return (
          <div className="flex items-center justify-center h-[50vh] text-slate-400 animate-fadein">
            <p>Section "{founderActiveNav}" is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        role="FOUNDER"
        userName={d.user.name}
        designation={d.user.designation}
        avatarInitials={d.user.avatarInitials}
        navItems={d.navItems}
        activeNav={founderActiveNav}
        onNavChange={setFounderActiveNav}
        onLogout={logout}
      />

      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <TopHeader
          greeting={founderActiveNav === 'Overview' ? `Welcome Founder! 👑` : founderActiveNav}
          subtitle={founderActiveNav === 'Overview' ? 'Platform performance, multi-tenant telemetry & global controls' : `Super Admin management for ${founderActiveNav.toLowerCase()}`}
          showBackButton={canGoBack}
          previousNavLabel={previousNav}
          onBack={goBack}
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

export default function FounderDashboardPage() {
  return (
    <RouteGuard allowedRoles={['FOUNDER']}>
      <Suspense fallback={<FullPageSkeleton />}>
        <FounderDashboardInner />
      </Suspense>
    </RouteGuard>
  );
}
