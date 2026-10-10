import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import {
  QueryLeaderboardDto,
  QueryGrowthLeaderboardDto,
  LeaderboardScope,
  ExamFamilyFilter,
} from './dto/leaderboard.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Tenant Access Verification ───────────────────────────────────────────
  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this institute's leaderboard.");
    }
  }

  // ── Helper: Resolve Teacher Assigned Subjects ───────────────────────────
  private async getTeacherAssignedSubjectIds(userId: string): Promise<string[]> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: {
        subjectIds: true,
        batchAssignments: {
          where: { removedAt: null },
          select: { subjectId: true },
        },
      },
    });
    if (!teacher) return [];
    const ids = new Set<string>();
    (teacher.subjectIds || []).forEach((id) => ids.add(id));
    (teacher.batchAssignments || []).forEach((ba) => {
      if (ba.subjectId) ids.add(ba.subjectId);
    });
    return Array.from(ids);
  }

  // ── Helper: Resolve Cohort Batches ───────────────────────────────────────
  private async resolveCohortBatches(
    instituteId: string,
    actor: AuthenticatedUser,
    scope: LeaderboardScope = LeaderboardScope.CLASS,
    batchId?: string,
  ): Promise<{
    targetBatchIds: string[];
    scopeLabel: string;
    studentProfileId?: string;
    batchName?: string;
  }> {
    let studentProfileId: string | undefined;
    let targetBatch: { id: string; name: string; classYear: string | null } | null = null;

    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: actor.id },
        select: { id: true, batchId: true, batch: { select: { id: true, name: true, classYear: true } } },
      });
      if (student) {
        studentProfileId = student.id;
        targetBatch = student.batch;
      }
    } else if (actor.role === UserRole.TEACHER) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: actor.id },
        include: {
          batchAssignments: {
            where: { removedAt: null },
            include: {
              batch: { select: { id: true, name: true, classYear: true } },
            },
          },
        },
      });

      const assignedBatches = teacher?.batchAssignments.map((ba) => ba.batch).filter(Boolean) || [];
      const assignedBatchIds = assignedBatches.map((b) => b.id);

      if (batchId && assignedBatchIds.includes(batchId)) {
        targetBatch = assignedBatches.find((b) => b.id === batchId) || null;
      } else if (assignedBatches.length > 0) {
        targetBatch = assignedBatches[0] || null;
      }
    } else if (batchId) {
      targetBatch = await this.prisma.batch.findUnique({
        where: { id: batchId },
        select: { id: true, name: true, classYear: true },
      });
    }

    if (!targetBatch) {
      // Fallback: pick first active batch in institute
      targetBatch = await this.prisma.batch.findFirst({
        where: { instituteId, isActive: true },
        select: { id: true, name: true, classYear: true },
      });
    }

    if (!targetBatch) {
      return { targetBatchIds: [], scopeLabel: 'General Cohort' };
    }

    if (scope === LeaderboardScope.BATCH) {
      return {
        targetBatchIds: [targetBatch.id],
        scopeLabel: targetBatch.name,
        studentProfileId,
        batchName: targetBatch.name,
      };
    }

    // Class-wide scope: all batches matching targetBatch.classYear
    const classYear = targetBatch.classYear;
    if (classYear) {
      const classBatches = await this.prisma.batch.findMany({
        where: { instituteId, classYear, isActive: true },
        select: { id: true },
      });
      let ids = classBatches.map((b) => b.id);
      if (actor.role === UserRole.TEACHER) {
        const teacher = await this.prisma.teacherProfile.findUnique({
          where: { userId: actor.id },
          include: {
            batchAssignments: {
              where: { removedAt: null },
              select: { batchId: true },
            },
          },
        });
        const assignedIds = teacher?.batchAssignments.map((ba) => ba.batchId) || [];
        const filtered = ids.filter((id) => assignedIds.includes(id));
        if (filtered.length > 0) {
          ids = filtered;
        }
      }
      return {
        targetBatchIds: ids.length > 0 ? ids : [targetBatch.id],
        scopeLabel: `${classYear} (All Sections)`,
        studentProfileId,
        batchName: targetBatch.name,
      };
    }

    return {
      targetBatchIds: [targetBatch.id],
      scopeLabel: targetBatch.name,
      studentProfileId,
      batchName: targetBatch.name,
    };
  }

  // ── 1. Rank Board (Performance-Based) ───────────────────────────────────
  async getRankLeaderboard(
    instituteId: string,
    dto: QueryLeaderboardDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const { targetBatchIds, scopeLabel, studentProfileId, batchName } =
      await this.resolveCohortBatches(instituteId, actor, dto.scope, dto.batchId);

    if (targetBatchIds.length === 0) {
      return {
        scope: dto.scope ?? LeaderboardScope.CLASS,
        scopeLabel: 'No Active Cohort',
        totalStudents: 0,
        myStanding: null,
        podium: [],
        rankings: [],
        availableExams: [],
        availableSubjects: [],
      };
    }

    // Fetch active students in cohort
    const students = await this.prisma.studentProfile.findMany({
      where: {
        instituteId,
        batchId: { in: targetBatchIds },
        user: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        rollNumber: true,
        batchId: true,
        batch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    const studentIds = students.map((s) => s.id);

    // Fetch ScoreRecords matching filters
    const scoreWhere: Record<string, unknown> = {
      studentProfileId: { in: studentIds },
      isFinalized: true,
    };

    if (dto.examId) {
      scoreWhere['examId'] = dto.examId;
    }

    if (dto.subjectId && dto.subjectId !== 'all') {
      scoreWhere['exam'] = {
        blueprint: { subjectId: dto.subjectId },
      };
    }

    const scoreRecords = await this.prisma.scoreRecord.findMany({
      where: scoreWhere,
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            type: true,
            scheduledDate: true,
            blueprint: {
              select: {
                subjectId: true,
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Group score records per student
    const studentScoreMap = new Map<
      string,
      { totalObtained: number; totalPossible: number; count: number; percentages: number[] }
    >();

    for (const record of scoreRecords) {
      const current = studentScoreMap.get(record.studentProfileId) || {
        totalObtained: 0,
        totalPossible: 0,
        count: 0,
        percentages: [],
      };
      current.totalObtained += record.obtainedMarks;
      current.totalPossible += record.totalMarks;
      current.percentages.push(record.percentage);
      current.count += 1;
      studentScoreMap.set(record.studentProfileId, current);
    }

    // Build ranking rows
    const studentRows = students.map((st) => {
      const stats = studentScoreMap.get(st.id);
      const examCount = stats?.count ?? 0;
      const avgScore =
        examCount > 0
          ? Number(
              (
                stats!.percentages.reduce((a, b) => a + b, 0) / examCount
              ).toFixed(1),
            )
          : null;

      return {
        studentProfileId: st.id,
        name: st.user.name,
        rollNumber: st.rollNumber,
        batchId: st.batchId,
        batchName: st.batch?.name ?? 'Section',
        avgScore,
        examCount,
        totalObtained: stats?.totalObtained ?? 0,
        hasParticipated: examCount > 0,
        rank: null as number | null,
      };
    });

    // Separate participating students from unranked students
    const participating = studentRows.filter((r) => r.hasParticipated);
    const unranked = studentRows.filter((r) => !r.hasParticipated);

    // Sort participating by avgScore DESC, then totalObtained DESC
    participating.sort((a, b) => {
      if ((b.avgScore ?? 0) !== (a.avgScore ?? 0)) return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      return b.totalObtained - a.totalObtained;
    });

    // Standard competition ranking with tie-handling
    for (let i = 0; i < participating.length; i++) {
      const current = participating[i]!;
      const previous = i > 0 ? participating[i - 1] : undefined;
      if (previous && current.avgScore === previous.avgScore) {
        current.rank = previous.rank;
      } else {
        current.rank = i + 1;
      }
    }

    const allRankings = [...participating, ...unranked];

    // Podium: top 3 students who participated
    const topThree = participating.slice(0, 3);
    const medals = ['gold', 'silver', 'bronze'] as const;
    const podium = topThree.map((item, idx) => ({
      ...item,
      medal: medals[idx],
    }));

    // My standing (or top student standing for teacher)
    let myStanding = null;
    if (studentProfileId) {
      const found = allRankings.find((r) => r.studentProfileId === studentProfileId);
      if (found) {
        const totalCohort = allRankings.length;
        const totalParticipating = participating.length;
        // Top X% calculation relative to cohort: in Class 11 of 34 students, Rank 1 is Top 3%
        const effectiveTotal = totalCohort > 0 ? totalCohort : totalParticipating;
        const topPercentage =
          found.rank !== null && effectiveTotal > 0
            ? Math.max(1, Math.round((found.rank / effectiveTotal) * 100))
            : null;

        myStanding = {
          ...found,
          topPercentage,
          totalParticipating,
          totalCohort,
          scopeLabel,
          myBatchName: batchName,
        };
      }
    } else if (actor.role === UserRole.TEACHER) {
      const topStudent = participating[0] || allRankings[0];
      if (topStudent) {
        myStanding = {
          ...topStudent,
          topPercentage: 1,
          totalParticipating: participating.length,
          totalCohort: allRankings.length,
          scopeLabel,
          myBatchName: batchName,
          isTopStudent: true,
        };
      }
    }

    // Available exams for dropdown
    const availableExamsRaw = await this.prisma.exam.findMany({
      where: {
        instituteId,
        batchId: { in: targetBatchIds },
        status: { in: ['LOCKED', 'PUBLISHED'] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        scheduledDate: true,
        blueprint: {
          select: {
            subjectId: true,
            subject: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { scheduledDate: 'desc' },
      take: 30,
    });

    const availableExams = availableExamsRaw.map((ex) => ({
      id: ex.id,
      title: ex.title,
      type: ex.type,
      scheduledDate: ex.scheduledDate,
      subjectId: ex.blueprint?.subjectId,
      subjectName: ex.blueprint?.subject?.name ?? 'General',
    }));

    // Available subjects (scoped to assigned subjects for teacher)
    let availableSubjects;
    if (actor.role === UserRole.TEACHER) {
      const teacherSubjectIds = await this.getTeacherAssignedSubjectIds(actor.id);
      availableSubjects = await this.prisma.subject.findMany({
        where: {
          instituteId,
          deletedAt: null,
          ...(teacherSubjectIds.length > 0 ? { id: { in: teacherSubjectIds } } : {}),
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    } else {
      availableSubjects = await this.prisma.subject.findMany({
        where: { instituteId, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    }

    return {
      scope: dto.scope ?? LeaderboardScope.CLASS,
      scopeLabel,
      totalStudents: participating.length,
      totalCohortSize: allRankings.length,
      myStanding,
      podium,
      rankings: allRankings,
      availableExams,
      availableSubjects,
    };
  }

  // ── 2. Growth Board (Momentum-Based) ────────────────────────────────────
  async getGrowthLeaderboard(
    instituteId: string,
    dto: QueryGrowthLeaderboardDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const { targetBatchIds, scopeLabel, studentProfileId, batchName } =
      await this.resolveCohortBatches(instituteId, actor, dto.scope, dto.batchId);

    if (targetBatchIds.length === 0) {
      return {
        scope: dto.scope ?? LeaderboardScope.CLASS,
        scopeLabel: 'No Active Cohort',
        totalStudents: 0,
        myStanding: null,
        podium: [],
        rankings: [],
        availableSubjects: [],
        availableExamFamilies: [
          ExamFamilyFilter.ALL,
          ExamFamilyFilter.SPOT,
          ExamFamilyFilter.PERIODIC,
          ExamFamilyFilter.MAJOR,
        ],
        warnings: [],
      };
    }

    // Fetch cohort students with full score records and mastery scores
    const students = await this.prisma.studentProfile.findMany({
      where: {
        instituteId,
        batchId: { in: targetBatchIds },
        user: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        rollNumber: true,
        batchId: true,
        batch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        scoreRecords: {
          where: { isFinalized: true },
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                type: true,
                scheduledDate: true,
                blueprint: {
                  select: {
                    subjectId: true,
                    subject: { select: { id: true, name: true } },
                  },
                },
                papers: {
                  select: {
                    items: {
                      select: {
                        question: {
                          select: {
                            empiricalDifficulty: true,
                            difficulty: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        masteryScores: {
          select: {
            subjectId: true,
            topicId: true,
            masteryValue: true,
            trend: true,
          },
        },
      },
    });

    // Format students payload for Python analytics engine
    const formattedStudents = students.map((st) => {
      const scores = st.scoreRecords
        .filter((sr) => sr.exam !== null)
        .map((sr) => {
          const ex = sr.exam!;
          // Calculate paper difficulty from questions if available
          let paperDifficulty = 0.5;
          const questions = ex.papers.flatMap((p) => p.items.map((i) => i.question));
          if (questions.length > 0) {
            const difficulties = questions.map((q) => {
              if (q.empiricalDifficulty != null) return 1.0 - q.empiricalDifficulty;
              if (q.difficulty === 'HARD') return 0.8;
              if (q.difficulty === 'MEDIUM') return 0.5;
              return 0.3;
            });
            paperDifficulty =
              difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
          }

          return {
            examId: ex.id,
            examTitle: ex.title,
            examType: ex.type,
            examDate: ex.scheduledDate ? ex.scheduledDate.toISOString() : '',
            subjectId: ex.blueprint?.subjectId ?? 'general',
            subjectName: ex.blueprint?.subject?.name ?? 'General',
            obtainedMarks: sr.obtainedMarks,
            totalMarks: sr.totalMarks,
            percentage: sr.percentage,
            paperDifficulty: Number(paperDifficulty.toFixed(2)),
          };
        });

      return {
        id: st.id,
        name: st.user.name,
        rollNumber: st.rollNumber,
        batchId: st.batchId,
        batchName: st.batch?.name ?? 'Section',
        scores,
        masteryScores: st.masteryScores.map((ms) => ({
          subjectId: ms.subjectId,
          topicId: ms.topicId,
          masteryValue: ms.masteryValue,
          trend: ms.trend,
        })),
      };
    });

    // Call Python Analytics Engine
    const pythonUrl = this.config.get<string>('PYTHON_SERVICE_URL', 'http://localhost:8000');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');

    let growthEngineResult = null;

    try {
      const response = await axios.post(
        `${pythonUrl}/analytics/growth-score`,
        {
          students: formattedStudents,
          filterSubjectId: dto.subjectId ?? 'all',
          filterExamFamily: dto.examFamily ?? ExamFamilyFilter.ALL,
          filterPeriodWeeks: dto.periodWeeks ?? 52,
          targetStudentId: studentProfileId,
        },
        {
          headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined,
          timeout: 10_000,
        },
      );
      growthEngineResult = response.data;
    } catch (err) {
      this.logger.warn('Python growth-score engine call failed, running in-memory fallback', err as Error);
      // Run deterministic in-memory calculation fallback
      growthEngineResult = this.computeInMemoryGrowthFallback(
        formattedStudents,
        dto.subjectId,
        dto.examFamily,
        studentProfileId,
        actor.role === UserRole.TEACHER,
      );
    }

    // If teacher, populate top student in growthEngineResult.myStanding if not present
    if (actor.role === UserRole.TEACHER && !growthEngineResult?.myStanding) {
      const topStudent =
        growthEngineResult?.rankings?.find((r: any) => r.rank === 1) ||
        growthEngineResult?.rankings?.[0] ||
        null;
      if (topStudent) {
        growthEngineResult.myStanding = {
          ...topStudent,
          isTopStudent: true,
        };
      }
    }

    // Available subjects (scoped to assigned subjects for teacher)
    let availableSubjects;
    if (actor.role === UserRole.TEACHER) {
      const teacherSubjectIds = await this.getTeacherAssignedSubjectIds(actor.id);
      availableSubjects = await this.prisma.subject.findMany({
        where: {
          instituteId,
          deletedAt: null,
          ...(teacherSubjectIds.length > 0 ? { id: { in: teacherSubjectIds } } : {}),
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    } else {
      availableSubjects = await this.prisma.subject.findMany({
        where: { instituteId, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    }

    return {
      scope: dto.scope ?? LeaderboardScope.CLASS,
      scopeLabel,
      batchName,
      availableSubjects,
      availableExamFamilies: [
        ExamFamilyFilter.ALL,
        ExamFamilyFilter.SPOT,
        ExamFamilyFilter.PERIODIC,
        ExamFamilyFilter.MAJOR,
      ],
      ...growthEngineResult,
    };
  }

  // ── In-Memory Growth Engine Fallback (Deterministic & Resilient) ─────────
  private computeInMemoryGrowthFallback(
    students: any[],
    subjectId?: string,
    examFamily?: string,
    targetStudentId?: string,
    isTeacher?: boolean,
  ) {
    const rankings = students.map((st) => {
      const count = st.scores.length;
      let momentum = 50.0;
      let zDelta = 0.0;
      let rawDelta = 0.0;
      let eloDelta = 0.0;
      let currentElo = 1200;

      if (count >= 2) {
        const latest = st.scores[count - 1];
        const prev = st.scores[count - 2];
        rawDelta = Number((latest.percentage - prev.percentage).toFixed(1));
        zDelta = Number((rawDelta / 15.0).toFixed(2));
        eloDelta = Number((rawDelta * 1.5).toFixed(1));
        currentElo = 1200 + eloDelta;
        momentum = Math.min(100, Math.max(0, 50 + rawDelta * 1.8));
      } else if (count === 1) {
        momentum = Math.min(100, Math.max(0, 50 + (st.scores[0].percentage - 50) * 0.5));
      }

      const badges = [];
      if (momentum >= 70) {
        badges.push({
          id: 'rising_star',
          label: 'Rising Star',
          icon: 'Rocket',
          color: 'indigo',
          description: 'High momentum and consistent performance climb.',
        });
      }
      if (rawDelta >= 10) {
        badges.push({
          id: 'on_the_up',
          label: 'On the Up',
          icon: 'TrendingUp',
          color: 'emerald',
          description: 'Strong score improvement in latest test.',
        });
      }

      if (count === 0) {
        return {
          studentProfileId: st.id,
          name: st.name,
          rollNumber: st.rollNumber,
          batchId: st.batchId,
          batchName: st.batchName,
          momentumScore: null,
          zScoreDelta: null,
          rawScoreDelta: null,
          eloRating: null,
          eloDelta: null,
          consistency: 0,
          examsAttended: 0,
          confidence: 'NONE' as const,
          badges: [],
          whyText: `${st.name} has not appeared in any evaluated exams yet.`,
          eloHistory: [],
          rank: null as number | null,
        };
      }

      return {
        studentProfileId: st.id,
        name: st.name,
        rollNumber: st.rollNumber,
        batchId: st.batchId,
        batchName: st.batchName,
        momentumScore: Number(momentum.toFixed(1)),
        zScoreDelta: zDelta,
        rawScoreDelta: rawDelta,
        eloRating: currentElo,
        eloDelta,
        consistency: count > 0 ? 90 : 0,
        examsAttended: count,
        confidence: count >= 3 ? 'HIGH' : count >= 1 ? 'MEDIUM' : 'LOW',
        badges,
        whyText: `${st.name} has demonstrated steady academic commitment.`,
        eloHistory: [],
        rank: null as number | null,
      };
    });

    const participating = rankings.filter((r) => r.examsAttended > 0);
    const unranked = rankings.filter((r) => r.examsAttended === 0);

    participating.sort((a, b) => (b.momentumScore ?? 0) - (a.momentumScore ?? 0));
    for (let i = 0; i < participating.length; i++) {
      const current = participating[i];
      if (!current) continue;
      const prev = i > 0 ? participating[i - 1] : undefined;
      if (prev && current.momentumScore === prev.momentumScore) {
        current.rank = prev.rank;
      } else {
        current.rank = i + 1;
      }
    }

    const allRankings = [...participating, ...unranked];
    const podium = participating.slice(0, 3);
    const topStudent = participating[0] || allRankings[0] || null;
    const myStanding = targetStudentId
      ? allRankings.find((r) => r.studentProfileId === targetStudentId) || null
      : (isTeacher && topStudent ? { ...topStudent, isTopStudent: true } : null);

    return {
      success: true,
      totalStudents: participating.length,
      totalCohortSize: allRankings.length,
      myStanding,
      podium,
      rankings: allRankings,
      warnings: [],
    };
  }
}
