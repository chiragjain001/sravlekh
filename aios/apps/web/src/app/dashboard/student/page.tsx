'use client';

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

export default function StudentDashboardPage() {
  const { logout } = useAuth();
  const { studentActiveNav, setStudentActiveNav } = useDashboardStore();

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
            <p>Section "{studentActiveNav}" is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        {/* Top Header */}
        <TopHeader
          greeting={`Good Morning, ${d.user.name.split(' ')[0]}! ☀️`}
          subtitle="Let's make today productive and impactful."
          showStreak
          streakCount={d.user.streak}
        />

        {/* Dynamic Section Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
