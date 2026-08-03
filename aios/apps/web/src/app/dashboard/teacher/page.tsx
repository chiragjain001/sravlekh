'use client';

import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import type { TeacherTopNav } from '@/store/dashboard-store';
import { teacherProfile } from '@/lib/mock-data/teacher';

// Shared layout
import { Sidebar }    from '@/components/shared/Sidebar';
import { TopHeader }  from '@/components/shared/TopHeader';
import { Calendar }   from 'lucide-react';

// Teacher screens — each is a self-contained full page
import { TeacherToday }           from '@/components/dashboard/teacher/screens/TeacherToday';
import { TeacherClasses }         from '@/components/dashboard/teacher/screens/TeacherClasses';
import { TeacherPaperBuilder }    from '@/components/dashboard/teacher/screens/TeacherPaperBuilder';
import { TeacherQuestionBank }    from '@/components/dashboard/teacher/screens/TeacherQuestionBank';
import { TeacherDoubtCenter }     from '@/components/dashboard/teacher/screens/TeacherDoubtCenter';
import { TeacherReports }             from '@/components/dashboard/teacher/screens/TeacherReports';
import { TeacherSettings }            from '@/components/dashboard/teacher/screens/TeacherSettings';
import { TeacherTestsExams }          from '@/components/dashboard/teacher/screens/TeacherTestsExams';
import { TeacherEvaluationQueue }     from '@/components/dashboard/teacher/screens/TeacherEvaluationQueue';
import { TeacherAnalytics }           from '@/components/dashboard/teacher/screens/TeacherAnalytics';
import { TeacherAssignments }         from '@/components/dashboard/teacher/screens/TeacherAssignments';
import { TeacherRemedialExtraClass }  from '@/components/dashboard/teacher/screens/TeacherRemedialExtraClass';
import { TeacherTimeTable }           from '@/components/dashboard/teacher/screens/TeacherTimeTable';

// ─── Sidebar nav config matching mockup ─────────────────────────────────────────
const NAV_ITEMS: { key: TeacherTopNav; label: string }[] = [
  { key: 'today',            label: 'Overview'               },
  { key: 'classes',          label: 'My Classes'             },
  { key: 'paper-builder',    label: 'Paper Builder'          },
  { key: 'question-bank',    label: 'Question Bank'          },
  { key: 'tests-exams',      label: 'Tests & Exams'          },
  { key: 'evaluation-queue', label: 'Evaluation Queue'     },
  { key: 'analytics',        label: 'Analytics'             },
  { key: 'assignments',      label: 'Assignments'           },
  { key: 'remedial-extra',   label: 'Remedial & Extra Class' },
  { key: 'doubt-center',     label: 'Doubt Center'           },
  { key: 'timetable',        label: 'Time Table'             },
  { key: 'reports',          label: 'Reports'                },
  { key: 'settings',         label: 'Settings'               },
];

export default function TeacherDashboardPage() {
  const { logout }                             = useAuth();
  const { teacherNav, setTeacherNav, setTeacherCtx } = useDashboardStore();

  const handleNavClick = (key: TeacherTopNav) => {
    setTeacherNav(key);
  };

  const renderScreen = () => {
    switch (teacherNav) {
      case 'today':            return <TeacherToday />;
      case 'classes':          return <TeacherClasses />;
      case 'paper-builder':    return <TeacherPaperBuilder />;
      case 'question-bank':    return <TeacherQuestionBank />;
      case 'tests-exams':      return <TeacherTestsExams />;
      case 'evaluation-queue': return <TeacherEvaluationQueue />;
      case 'analytics':        return <TeacherAnalytics />;
      case 'assignments':      return <TeacherAssignments />;
      case 'remedial-extra':   return <TeacherRemedialExtraClass />;
      case 'doubt-center':     return <TeacherDoubtCenter />;
      case 'timetable':        return <TeacherTimeTable />;
      case 'reports':          return <TeacherReports />;
      case 'settings':         return <TeacherSettings />;
      default:                 return <TeacherToday />;
    }
  };


  const activeLabel = NAV_ITEMS.find(n => n.key === teacherNav)?.label ?? 'Today';

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        role="TEACHER"
        userName={teacherProfile.name}
        designation={teacherProfile.designation}
        avatarInitials={teacherProfile.avatarInitials}
        navItems={NAV_ITEMS.map(n => n.label)}
        activeNav={activeLabel}
        onNavChange={(label) => {
          const match = NAV_ITEMS.find(n => n.label === label);
          if (match) handleNavClick(match.key);
        }}
        onLogout={logout}
      />

      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <TopHeader
          greeting={`Good Morning, ${teacherProfile.name.split(' ')[0]} Sir! ☀️`}
          subtitle="Here's what's happening in your classes."
          rightContent={
            <div className="flex items-center gap-1.5 bg-indigo-50 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-[13px] font-bold text-indigo-700">08</span>
              <span className="text-[11px] text-indigo-500">Classes Today</span>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto">
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}
