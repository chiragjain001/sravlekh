'use client';

import { Suspense } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopHeader } from '@/components/shared/TopHeader';
import { useDashboardStore } from '@/store/dashboard-store';
import { studentData as d } from '@/lib/mock-data/student';

// Sections
import { StudentOverview } from '@/components/dashboard/student/StudentOverview';
import { StudentTests } from '@/components/dashboard/student/StudentTests';
import { StudentAssignments } from '@/components/dashboard/student/StudentAssignments';
import { StudentStudyPlan } from '@/components/dashboard/student/StudentStudyPlan';
import { StudentWeakTopics } from '@/components/dashboard/student/StudentWeakTopics';
import { StudentDoubtCenter } from '@/components/dashboard/student/StudentDoubtCenter';
import { StudentTimeTable } from '@/components/dashboard/student/StudentTimetable';
import { StudentExtraClasses } from '@/components/dashboard/student/StudentExtraClasses';
import { StudentProgress } from '@/components/dashboard/student/StudentProgress';
import { StudentLeaderboard } from '@/components/dashboard/student/StudentLeaderboard';
import { StudentResources } from '@/components/dashboard/student/StudentResources';
import { StudentSettings } from '@/components/dashboard/student/StudentSettings';

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

// ── Inner component — uses useNavigationHistory (which calls useSearchParams)
// Must be wrapped in <Suspense> at the page level per Next.js 14 requirements.
function StudentDashboardInner() {
  const { logout } = useAuth();
  const { studentActiveNav, setStudentActiveNav } = useDashboardStore();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { canGoBack, previousNav, goBack } = useNavigationHistory('student');

  const renderContent = () => {
    switch (studentActiveNav) {
      case 'Overview':      return <StudentOverview />;
      case 'My Tests':      return <StudentTests />;
      case 'Assignments':   return <StudentAssignments />;
      case 'Study Plan':    return <StudentStudyPlan />;
      case 'Weak Topics':   return <StudentWeakTopics />;
      case 'Doubt Center':  return <StudentDoubtCenter />;
      case 'Time Table':    return <StudentTimeTable />;
      case 'Extra Classes': return <StudentExtraClasses />;
      case 'Progress':      return <StudentProgress />;
      case 'Leaderboard':   return <StudentLeaderboard />;
      case 'Resources':     return <StudentResources />;
      case 'Settings':      return <StudentSettings />;
      default:
        return (
          <div className="flex items-center justify-center h-[50vh] text-slate-400 animate-fadein">
            <p>Section &quot;{studentActiveNav}&quot; is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        role="STUDENT"
        userName={d.user.name}
        designation={d.user.class}
        avatarInitials={d.user.avatarInitials}
        navItems={d.navItems}
        activeNav={studentActiveNav}
        onNavChange={setStudentActiveNav}
        onLogout={logout}
      />
      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <TopHeader
          greeting={studentActiveNav === 'Overview' ? `Good Morning, ${d.user.name.split(' ')[0]}! ☀️` : studentActiveNav}
          subtitle={studentActiveNav === 'Overview' ? "Let's make today productive and impactful." : `View and manage your ${studentActiveNav.toLowerCase()}`}
          showStreak={studentActiveNav === 'Overview'}
          streakCount={d.user.streak}
        />
        <div className="flex-1">{renderContent()}</div>
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-bg text-slate-400 text-[14px]">
        Loading…
      </div>
    }>
      <StudentDashboardInner />
    </Suspense>
  );
}
