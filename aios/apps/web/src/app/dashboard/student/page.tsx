'use client';

import { Suspense } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopHeader } from '@/components/shared/TopHeader';
import { useDashboardStore } from '@/store/dashboard-store';
import { studentData as d } from '@/lib/mock-data/student';
import { RouteGuard, FullPageSkeleton } from '@/components/ui/RouteGuard';
import { ScreenLoadingState } from '@/components/ui/foundation';

import dynamic from 'next/dynamic';

import { StudentOverview } from '@/components/dashboard/student/StudentOverview';
import { StudentProgress } from '@/components/dashboard/student/StudentProgress';
import { StudentLeaderboard } from '@/components/dashboard/student/StudentLeaderboard';

const SectionLoader = () => (
  <ScreenLoadingState
    title="Loading Student Portal..."
    subtitle="Fetching your academic schedule, tests, and learning resources..."
    layout="cards"
  />
);

const StudentAttendance = dynamic(() => import('@/components/dashboard/student/StudentAttendance').then((m) => m.StudentAttendance), { loading: SectionLoader });
const StudentTests = dynamic(() => import('@/components/dashboard/student/StudentTests').then((m) => m.StudentTests), { loading: SectionLoader });
const StudentAssignments = dynamic(() => import('@/components/dashboard/student/StudentAssignments').then((m) => m.StudentAssignments), { loading: SectionLoader });
const StudentStudyPlan = dynamic(() => import('@/components/dashboard/student/StudentStudyPlan').then((m) => m.StudentStudyPlan), { loading: SectionLoader });
const StudentWeakTopics = dynamic(() => import('@/components/dashboard/student/StudentWeakTopics').then((m) => m.StudentWeakTopics), { loading: SectionLoader });
const StudentDoubtCenter = dynamic(() => import('@/components/dashboard/student/StudentDoubtCenter').then((m) => m.StudentDoubtCenter), { loading: SectionLoader });
const StudentTimeTable = dynamic(() => import('@/components/dashboard/student/StudentTimetable').then((m) => m.StudentTimeTable), { loading: SectionLoader });
const StudentExtraClasses = dynamic(() => import('@/components/dashboard/student/StudentExtraClasses').then((m) => m.StudentExtraClasses), { loading: SectionLoader });
const StudentResources = dynamic(() => import('@/components/dashboard/student/StudentResources').then((m) => m.StudentResources), { loading: SectionLoader });
const StudentSettings = dynamic(() => import('@/components/dashboard/student/StudentSettings').then((m) => m.StudentSettings), { loading: SectionLoader });

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

// ── Inner component — uses useNavigationHistory (which calls useSearchParams)
// Must be wrapped in <Suspense> at the page level per Next.js 14 requirements.
function StudentDashboardInner() {
  const { user, logout } = useAuth();
  const { studentActiveNav, setStudentActiveNav } = useDashboardStore();
  const studentName = user?.name ?? 'Student';
  const firstName = studentName.split(' ')[0];
  const avatarInitials = user?.avatarInitials ?? studentName.split(' ').map((n) => n[0]).join('').toUpperCase();
  const { canGoBack, previousNav, goBack } = useNavigationHistory('student');

  const renderContent = () => {
    switch (studentActiveNav) {
      case 'Overview':      return <StudentOverview />;
      case 'Attendance':    return <StudentAttendance />;
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
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-bg">
      <Sidebar
        role="STUDENT"
        userName={studentName}
        designation="Student"
        avatarInitials={avatarInitials}
        navItems={d.navItems}
        activeNav={studentActiveNav}
        onNavChange={setStudentActiveNav}
        onLogout={logout}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 flex flex-col max-w-full">
        <TopHeader
          greeting={studentActiveNav === 'Overview' ? `Good Morning, ${firstName}! ☀️` : studentActiveNav}
          subtitle={
            studentActiveNav === 'Overview'
              ? "Let's make today productive and impactful."
              : studentActiveNav === 'Resources'
              ? 'Interactive formula decks & active-recall revision flashcards.'
              : `View and manage your ${studentActiveNav.replace(/^My\s+/i, '').toLowerCase()}`
          }
          showBackButton={canGoBack}
          previousNavLabel={previousNav}
          onBack={goBack}
        />
        <div className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden">{renderContent()}</div>
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <RouteGuard allowedRoles={['STUDENT']}>
      <Suspense fallback={<FullPageSkeleton />}>
        <StudentDashboardInner />
      </Suspense>
    </RouteGuard>
  );
}
