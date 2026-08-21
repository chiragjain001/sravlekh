'use client';

import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import type { TeacherTopNav } from '@/store/dashboard-store';
import { teacherProfile } from '@/lib/mock-data/teacher';
import { Suspense } from 'react';

// Shared layout
import { Sidebar }   from '@/components/shared/Sidebar';
import { TopHeader } from '@/components/shared/TopHeader';
import { Calendar }  from 'lucide-react';

// Foundation components (Phase 0)
import { RouteGuard, FullPageSkeleton } from '@/components/ui/RouteGuard';
import { PageErrorBoundary }            from '@/components/ui/ErrorBoundary';
import { OfflineBanner }                from '@/components/ui/foundation';

// URL sync (Phase 1)
import { useContextUrlSync } from '@/hooks/useContextUrlSync';
import { useNetworkStatus }  from '@/hooks/useContextUrlSync';

// Teacher screens — each is a self-contained full page
import { TeacherToday }           from '@/components/dashboard/teacher/screens/TeacherToday';
import { TeacherClasses }         from '@/components/dashboard/teacher/screens/TeacherClasses';
import { QuestionBankManager }    from '@/components/dashboard/questions/QuestionBankManager';
import { TeacherPaperBuilder }    from '@/components/dashboard/teacher/screens/TeacherPaperBuilder';
import { TeacherDoubtCenter }     from '@/components/dashboard/teacher/screens/TeacherDoubtCenter';
import { TeacherReports }         from '@/components/dashboard/teacher/screens/TeacherReports';
import { TeacherSettings }        from '@/components/dashboard/teacher/screens/TeacherSettings';
import { TeacherTestsExams }      from '@/components/dashboard/teacher/screens/TeacherTestsExams';
import { TeacherEvaluationQueue } from '@/components/dashboard/teacher/screens/TeacherEvaluationQueue';
import { TeacherAnalytics }       from '@/components/dashboard/teacher/screens/TeacherAnalytics';
import { TeacherAssignments }     from '@/components/dashboard/teacher/screens/TeacherAssignments';
import { TeacherRemedialExtraClass } from '@/components/dashboard/teacher/screens/TeacherRemedialExtraClass';
import { TeacherTimeTable }          from '@/components/dashboard/teacher/screens/TeacherTimeTable';

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV_ITEMS: { key: TeacherTopNav; label: string }[] = [
  { key: 'today',          label: 'Overview'               },
  { key: 'classes',        label: 'My Classes'             },
  { key: 'question-bank',  label: 'Question Bank'          },
  { key: 'paper-builder',  label: 'Paper Builder'          },
  { key: 'tests-exams',    label: 'Tests & Exams'          },
  { key: 'analytics',      label: 'Analytics'              },
  { key: 'assignments',    label: 'Assignments'            },
  { key: 'remedial-extra', label: 'Remedial & Extra Class' },
  { key: 'doubt-center',   label: 'Doubt Center'           },
  { key: 'timetable',      label: 'Time Table'             },
  { key: 'reports',        label: 'Reports'                },
  { key: 'settings',       label: 'Settings'               },
];

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

// ─── Inner Dashboard (rendered after auth guard passes) ───────────────────────
function TeacherDashboardInner() {
  const { user, logout }                            = useAuth();
  const { teacherNav, setTeacherNav, setTeacherCtx } = useDashboardStore();
  const { canGoBack, previousNav, goBack }           = useNavigationHistory('teacher');

  // Phase 1: Sync context ↔ URL (enables deep linking + browser back)
  useContextUrlSync('teacher');

  // Phase 1: Monitor network status for OfflineBanner
  useNetworkStatus();

  const renderScreen = () => {
    switch (teacherNav) {
      case 'today':            return <TeacherToday />;
      case 'classes':          return <TeacherClasses />;
      case 'question-bank':    return <QuestionBankManager />;
      case 'paper-builder':    return <TeacherPaperBuilder />;
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

  const activeLabel = NAV_ITEMS.find(n => n.key === teacherNav)?.label ?? 'Overview';
  const previousNavLabel = NAV_ITEMS.find(n => n.key === previousNav)?.label ?? previousNav;
  const teacherName = user?.name ?? teacherProfile.name;
  const firstName   = teacherName.split(' ')[0];

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Global offline banner */}
      <OfflineBanner />

      <Sidebar
        role="TEACHER"
        userName={teacherName}
        designation={teacherProfile.designation}
        avatarInitials={user?.avatarInitials ?? teacherProfile.avatarInitials}
        navItems={NAV_ITEMS.map(n => n.label)}
        activeNav={activeLabel}
        onNavChange={(label) => {
          const match = NAV_ITEMS.find(n => n.label === label);
          if (match) {
            if (match.key === 'classes') {
              setTeacherCtx({
                classId: null,
                batchId: null,
                studentId: null,
                testId: null,
                batchTab: 'overview',
              });
            }
            setTeacherNav(match.key);
          }
        }}
        onLogout={logout}
      />

      <div className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <TopHeader
          greeting={`Good Morning, ${firstName} Sir! ☀️`}
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
          <PageErrorBoundary>
            {renderScreen()}
          </PageErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  return (
    <RouteGuard allowedRoles={['TEACHER', 'ADMIN', 'ACADEMIC_HEAD']}>
      <Suspense fallback={<FullPageSkeleton />}>
        <TeacherDashboardInner />
      </Suspense>
    </RouteGuard>
  );
}
