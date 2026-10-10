'use client';

import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import type { TeacherTopNav } from '@/store/dashboard-store';
import { useMyTeacherProfile, useTimetable, useEvaluationWorkItems } from '@/hooks/useApi';
import { Suspense, useMemo } from 'react';

// Shared layout
import { Sidebar }   from '@/components/shared/Sidebar';
import { TopHeader } from '@/components/shared/TopHeader';
import { Calendar }  from 'lucide-react';

// Foundation components (Phase 0)
import { RouteGuard, FullPageSkeleton } from '@/components/ui/RouteGuard';
import { PageErrorBoundary }            from '@/components/ui/ErrorBoundary';
import { OfflineBanner, ScreenLoadingState } from '@/components/ui/foundation';

// URL sync (Phase 1)
import { useContextUrlSync } from '@/hooks/useContextUrlSync';
import { useNetworkStatus }  from '@/hooks/useContextUrlSync';

import dynamic from 'next/dynamic';

// Teacher screens — TeacherToday is eager (landing tab), others are code-split
import { TeacherToday }           from '@/components/dashboard/teacher/screens/TeacherToday';

const TeacherClasses = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherClasses').then((m) => m.TeacherClasses),
  { loading: () => <ScreenLoadingState title="Loading My Classes..." subtitle="Fetching your batches, subjects, and student rosters..." layout="cards" /> }
);
const QuestionBankManager = dynamic(
  () => import('@/components/dashboard/questions/QuestionBankManager').then((m) => m.QuestionBankManager),
  { loading: () => <ScreenLoadingState title="Loading Question Bank..." subtitle="Fetching questions, difficulty tags, and syllabus topics..." layout="table" /> }
);
const TeacherPaperBuilder = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherPaperBuilder').then((m) => m.TeacherPaperBuilder),
  { loading: () => <ScreenLoadingState title="Loading Paper Builder..." subtitle="Preparing question bank blueprint and generator tools..." layout="details" /> }
);
const TeacherDoubtCenter = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherDoubtCenter').then((m) => m.TeacherDoubtCenter),
  { loading: () => <ScreenLoadingState title="Loading Doubt Center..." subtitle="Fetching student questions, priorities, and discussions..." layout="cards" /> }
);
const TeacherSettings = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherSettings').then((m) => m.TeacherSettings),
  { loading: () => <ScreenLoadingState title="Loading Settings..." subtitle="Fetching profile information and account preferences..." layout="details" /> }
);
const TeacherAssessmentsHub = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherAssessmentsHub').then((m) => m.TeacherAssessmentsHub),
  { loading: () => <ScreenLoadingState title="Loading Assessments..." subtitle="Fetching tests, scheduled exams, and assignments..." layout="table" /> }
);
const TeacherEvaluationQueue = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherEvaluationQueue').then((m) => m.TeacherEvaluationQueue),
  { loading: () => <ScreenLoadingState title="Loading Evaluation Queue..." subtitle="Fetching student subjective responses for grading..." layout="table" /> }
);
const TeacherDocumentQueue = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherDocumentQueue').then((m) => m.TeacherDocumentQueue),
  { loading: () => <ScreenLoadingState title="Loading Digital Answer Sheets..." subtitle="Fetching scanned booklets and assessment deliveries..." layout="cards" /> }
);
const TeacherRemedialExtraClass = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherRemedialExtraClass').then((m) => m.TeacherRemedialExtraClass),
  { loading: () => <ScreenLoadingState title="Loading Remedial & Extra Classes..." subtitle="Fetching schedule and batch mastery data..." layout="cards" /> }
);
const TeacherTimeTable = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherTimeTable').then((m) => m.TeacherTimeTable),
  { loading: () => <ScreenLoadingState title="Loading Time Table..." subtitle="Preparing your weekly teaching schedule..." layout="grid" /> }
);
const TeacherLeaderboard = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherLeaderboard').then((m) => m.TeacherLeaderboard),
  { loading: () => <ScreenLoadingState title="Loading Leaderboard..." subtitle="Fetching cohort rankings and learning momentum..." layout="table" /> }
);
const TeacherAttendance = dynamic(
  () => import('@/components/dashboard/teacher/screens/TeacherAttendance').then((m) => m.TeacherAttendance),
  { loading: () => <ScreenLoadingState title="Loading Attendance..." subtitle="Fetching today's timetable sessions and class rosters..." layout="cards" /> }
);

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV_ITEMS: { key: TeacherTopNav; label: string }[] = [
  { key: 'today',            label: 'Overview'              },
  { key: 'attendance',       label: 'Attendance'            },
  { key: 'classes',          label: 'My Classes'            },
  { key: 'question-bank',    label: 'Question Bank'         },
  { key: 'paper-builder',    label: 'Paper Builder'         },
  { key: 'assessments',      label: 'Assessments'           },
  { key: 'digital-copy',     label: 'Digital Answer Sheets' },
  { key: 'evaluation-queue', label: 'Evaluation Queue'      },
  { key: 'leaderboard',      label: 'Leaderboard'           },
  { key: 'timetable',        label: 'Time Table'            },
  { key: 'doubt-center',     label: 'Doubt Center'          },
  { key: 'settings',         label: 'Settings'              },
  // Hidden from nav but kept as valid routes for deep links / internal navigation:
  // 'remedial-extra'
];

import { useNavigationHistory } from '@/hooks/useNavigationHistory';

// ─── Inner Dashboard (rendered after auth guard passes) ───────────────────────
function TeacherDashboardInner() {
  const { user, logout }                            = useAuth();
  const { teacherNav, setTeacherNav, setTeacherCtx } = useDashboardStore();
  const { canGoBack, previousNav, goBack }           = useNavigationHistory('teacher');
  const { data: profile } = useMyTeacherProfile();

  // Phase 1: Sync context ↔ URL (enables deep linking + browser back)
  useContextUrlSync('teacher');

  // Phase 1: Monitor network status for OfflineBanner
  useNetworkStatus();

  const todayTimetableParams = useMemo(() => {
    if (!user?.id) return undefined;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { teacherUserId: user.id, dateStart: start.toISOString(), dateEnd: end.toISOString() };
  }, [user?.id]);
  const { data: todaySlotsResp } = useTimetable(todayTimetableParams);
  const todaySlots: any[] = todaySlotsResp?.data ?? todaySlotsResp ?? [];

  // Deduplicated with TeacherToday preview queue ({ pageSize: 10 }) so only
  // ONE network request is made on dashboard load instead of two separate requests.
  const { data: evalQueueResp } = useEvaluationWorkItems({ pageSize: 10 });
  const evaluationQueueCount = evalQueueResp?.meta?.total ?? 0;

  const renderScreen = () => {
    switch (teacherNav) {
      case 'today':            return <TeacherToday />;
      case 'attendance':       return <TeacherAttendance />;
      case 'classes':          return <TeacherClasses />;
      case 'question-bank':    return <QuestionBankManager />;
      case 'paper-builder':    return <TeacherPaperBuilder />;
      case 'assessments':      return <TeacherAssessmentsHub />;
      case 'digital-copy':     return <TeacherDocumentQueue />;
      case 'evaluation-queue': return <TeacherEvaluationQueue />;
      case 'leaderboard':      return <TeacherLeaderboard />;
      case 'remedial-extra':   return <TeacherRemedialExtraClass />;
      case 'doubt-center':     return <TeacherDoubtCenter />;
      case 'timetable':        return <TeacherTimeTable />;
      case 'settings':         return <TeacherSettings />;
      default:                 return <TeacherToday />;
    }
  };

  const activeLabel = NAV_ITEMS.find(n => n.key === teacherNav)?.label ?? 'Overview';
  const previousNavLabel = NAV_ITEMS.find(n => n.key === previousNav)?.label ?? previousNav;
  const teacherName = user?.name ?? 'Teacher';
  const firstName   = teacherName.split(' ')[0];

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-bg">
      {/* Global offline banner */}
      <OfflineBanner />

      <Sidebar
        role="TEACHER"
        userName={teacherName}
        designation={profile?.qualification ?? 'Teacher'}
        avatarInitials={user?.avatarInitials ?? teacherName.split(' ').map(n => n[0]).join('').toUpperCase()}
        navItems={NAV_ITEMS.map(n => n.label)}
        activeNav={activeLabel}
        evaluationQueueCount={evaluationQueueCount}
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 flex flex-col max-w-full overscroll-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <TopHeader
          greeting={`Good Morning, ${firstName} Sir! ☀️`}
          subtitle="Here's what's happening in your classes."
          showBackButton={canGoBack}
          previousNavLabel={previousNavLabel}
          onBack={goBack}
          rightContent={
            <div className="flex items-center gap-1.5 bg-indigo-50 rounded-lg px-2.5 sm:px-3 py-1.5 flex-shrink-0">
              <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <span className="text-[13px] font-bold text-indigo-700">{todaySlots.length}</span>
              <span className="text-[11px] text-indigo-500 hidden sm:inline">Classes Today</span>
            </div>
          }
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

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  return (
    <RouteGuard allowedRoles={['TEACHER', 'ADMIN']}>
      <Suspense fallback={<FullPageSkeleton />}>
        <TeacherDashboardInner />
      </Suspense>
    </RouteGuard>
  );
}
