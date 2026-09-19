import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditAction, UserRole, ExamStatus, PaperStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { EXAM_STATUS_TRANSITIONS as NEXT_STATUS } from '../shared/exam-status-transitions';
import { withVersionGuard } from '../shared/version-guard';
import { getTeacherBatchIds } from '../shared/teacher-scope';
import { assertAllAnswerSheetsVerified } from '../shared/evaluation-lock-gate';
import {
  CreateExamDto,
  GradeAnswerSheetDto,
  UpdateExamStatusDto,
  UnlockExamDto,
} from './dto/exam.dto';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ── D-01: Create Exam ────────────────────────────────────────────────────

  async createExam(instituteId: string, dto: CreateExamDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const blueprint = await this.prisma.blueprint.findUnique({ where: { id: dto.blueprintId } });
    if (!blueprint || blueprint.instituteId !== instituteId) {
      throw new NotFoundException('Blueprint not found');
    }

    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found');
    }

    // Scheduling an exam in the past was previously accepted outright — the
    // frontend wizard even shipped with a stale hardcoded default date, which
    // meant a teacher could publish and never notice the test was scheduled
    // for a day that had already passed. Same-day is allowed (a teacher
    // running "Publish Immediately" for right now is still "today"); only a
    // date strictly before today is rejected.
    if (dto.scheduledDate) {
      const scheduled = new Date(dto.scheduledDate);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (scheduled < startOfToday) {
        throw new BadRequestException('The exam date cannot be in the past — pick today or a later date.');
      }
    }

    const exam = await this.prisma.exam.create({
      data: {
        instituteId,
        batchId: dto.batchId,
        blueprintId: dto.blueprintId,
        title: dto.title,
        type: dto.type,
        captureMode: dto.captureMode,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        durationMinutes: dto.durationMinutes ?? blueprint.duration,
        venue: dto.venue,
        createdByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'exams', exam.id, null, { title: exam.title });

    return exam;
  }

  // ── D-01: List / Get Exams ───────────────────────────────────────────────

  async findAll(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    // Teachers only see exams for their own batches — ADMIN/FOUNDER keep
    // institute-wide visibility, unaffected by this branch.
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);

    // Students only ever see exams for their own batch, and only once they're
    // actually scheduled — DRAFT/REVIEW/APPROVED are pre-publication working
    // states a student has no business seeing (audit finding: no student-
    // scoped "my upcoming exams" read path existed at all before this).
    let studentWhere: Record<string, unknown> | undefined;
    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id } });
      studentWhere = {
        batchId: student?.batchId ?? '__none__',
        status: { in: [ExamStatus.PUBLISHED, ExamStatus.ONGOING, ExamStatus.EVALUATING, ExamStatus.LOCKED] },
      };
    }

    return this.prisma.exam.findMany({
      where: {
        instituteId,
        ...(teacherBatchIds !== null && { batchId: { in: teacherBatchIds } }),
        ...studentWhere,
      },
      include: {
        batch: { select: { id: true, name: true } },
        blueprint: { select: { id: true, name: true, totalMarks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(instituteId: string, examId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        institute: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true, classYear: true, section: true } },
        // subject name included alongside the blueprint's own name — a printable
        // question paper header needs "Subject: Physics", not the blueprint's
        // internal title, and nothing else already exposes that link to a teacher.
        blueprint: { select: { id: true, name: true, totalMarks: true, duration: true, instructions: true, subject: { select: { id: true, name: true } } } },
        papers: { select: { id: true, title: true, status: true } },
      },
    });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    if (teacherBatchIds !== null && !teacherBatchIds.includes(exam.batchId)) {
      throw new ForbiddenException('You can only view exams for batches you are assigned to.');
    }

    return exam;
  }

  // ── D-01: Exam State Machine ─────────────────────────────────────────────

  async updateStatus(
    instituteId: string,
    examId: string,
    dto: UpdateExamStatusDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    if (exam.version !== dto.version) {
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: 'This exam was changed by someone else — refresh and try again.',
      });
    }

    const expectedNext = NEXT_STATUS[exam.status];
    if (!expectedNext || dto.status !== expectedNext) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: expectedNext
          ? `Exams move one stage at a time — from ${exam.status}, the next stage is ${expectedNext}.`
          : `A ${exam.status} exam cannot move forward — use unlock to reopen it for evaluation.`,
      });
    }

    // REVIEW -> APPROVED is a sign-off distinct from the creating teacher's own
    // workflow, mirroring the Question approval pattern (03-FEATURE-SPECIFICATIONS.md).
    if (dto.status === ExamStatus.APPROVED && actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can approve an exam.');
    }

    // P1 A4: v2's AssessmentsService has always gated LOCKED on unevaluated
    // subjective responses; v1 never gated LOCKED on anything grading-related at
    // all. v1 Exam has no stakesLevel/practice-vs-graded distinction — every v1
    // exam is a real, scored exam — so this applies unconditionally on LOCKED.
    // Uses AnswerSheet.isVerified, not Response/Evaluation state: v1 has no
    // Evaluation model involvement whatsoever (gradeAnswerSheet grades a whole
    // sheet atomically), so v2's Response-based check cannot be reused here — see
    // shared/evaluation-lock-gate.ts's assertAllAnswerSheetsVerified for why.
    // A real-database probe confirms this correctly allows LOCK once every
    // answer sheet is graded, and blocks it while any remain unverified.
    if (dto.status === ExamStatus.LOCKED) {
      await assertAllAnswerSheetsVerified(this.prisma, examId);
    }

    const data: Record<string, unknown> = { status: dto.status, version: { increment: 1 } };
    if (dto.status === ExamStatus.APPROVED) {
      data['approvedByUserId'] = actor.id;
      data['approvedAt'] = new Date();
    }
    if (dto.status === ExamStatus.PUBLISHED) {
      data['publishedAt'] = new Date();
    }
    if (dto.status === ExamStatus.LOCKED) {
      data['lockedAt'] = new Date();
      data['lockedByUserId'] = actor.id;
    }

    const auditAction: AuditAction =
      dto.status === ExamStatus.APPROVED ? AuditAction.APPROVE
      : dto.status === ExamStatus.PUBLISHED ? AuditAction.PUBLISH
      : dto.status === ExamStatus.LOCKED ? AuditAction.LOCK
      : AuditAction.UPDATE;

    // 03-FEATURE-SPECIFICATIONS.md's Audit & Governance module requires LOCK to be
    // atomic with its audit entry (same transaction) — an audit-write failure must
    // roll back the lock, not silently succeed with no trail. Every other transition
    // keeps the existing fire-and-forget writeAudit (audit failures never block those).
    if (auditAction === AuditAction.LOCK) {
      const [updated] = await withVersionGuard(
        this.prisma.$transaction([
          this.prisma.exam.update({ where: { id: examId, version: exam.version }, data }),
          this.prisma.auditLog.create({
            data: {
              instituteId, actorId: actor.id, action: auditAction, entity: 'exams', entityId: examId,
              oldValue: { status: exam.status } as any, newValue: { status: dto.status } as any,
            },
          }),
        ]),
        'exam',
      );
      return updated;
    }

    const updated = await withVersionGuard(
      this.prisma.exam.update({ where: { id: examId, version: exam.version }, data }),
      'exam',
    );
    await this.writeAudit(instituteId, actor.id, auditAction, 'exams', examId, { status: exam.status }, { status: dto.status });
    return updated;
  }

  /** LOCKED -> EVALUATING only. Admin-only, reason required (18-EDGE-CASES.md: "unlock
   * without reason -> 400"; enforced by UnlockExamDto's @MinLength(10) at the DTO layer). */
  async unlock(instituteId: string, examId: string, dto: UnlockExamDto, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can unlock a locked exam.');
    }
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    if (exam.version !== dto.version) {
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: 'This exam was changed by someone else — refresh and try again.',
      });
    }
    if (exam.status !== ExamStatus.LOCKED) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Only a locked exam can be unlocked.',
      });
    }

    // Atomic with its audit entry, same rationale as LOCK in updateStatus() above.
    const [updated] = await withVersionGuard(
      this.prisma.$transaction([
        this.prisma.exam.update({
          where: { id: examId, version: exam.version },
          data: { status: ExamStatus.EVALUATING, unlockReason: dto.reason, version: { increment: 1 } },
        }),
        this.prisma.auditLog.create({
          data: {
            instituteId, actorId: actor.id, action: AuditAction.UNLOCK, entity: 'exams', entityId: examId,
            oldValue: { status: ExamStatus.LOCKED } as any,
            newValue: { status: ExamStatus.EVALUATING, reason: dto.reason } as any,
          },
        }),
      ]),
      'exam',
    );

    return updated;
  }

  // ── Cancel an exam ───────────────────────────────────────────────────────
  //
  // Only while it is still being prepared. Once an exam is PUBLISHED the batch
  // has been told it is happening, and from ONGOING onwards answer sheets and
  // score records hang off it — deleting then would destroy real student work,
  // so those stages are refused and the exam should be moved through its normal
  // status flow instead.
  async deleteExam(instituteId: string, examId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    const cancellable: ExamStatus[] = [ExamStatus.DRAFT, ExamStatus.REVIEW, ExamStatus.APPROVED];
    if (!cancellable.includes(exam.status)) {
      throw new BadRequestException(
        `An exam can only be deleted while it is DRAFT, REVIEW or APPROVED — this one is ${exam.status}.`,
      );
    }

    const answerSheets = await this.prisma.answerSheet.count({ where: { examId } });
    if (answerSheets > 0) {
      throw new BadRequestException('This exam already has answer sheets and cannot be deleted.');
    }

    // Papers point at the exam; detach rather than delete, since a generated
    // paper is reusable work that outlives the exam it was linked to.
    await this.prisma.$transaction([
      this.prisma.paper.updateMany({ where: { examId }, data: { examId: null } }),
      this.prisma.exam.delete({ where: { id: examId } }),
      this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId: actor.id,
          action: AuditAction.DELETE,
          entity: 'exams',
          entityId: examId,
          oldValue: { title: exam.title, status: exam.status } satisfies Prisma.InputJsonValue,
        },
      }),
    ]);

    return { success: true };
  }

  // ── D-01: Link Generated Paper to Exam ───────────────────────────────────

  async linkPaper(instituteId: string, examId: string, paperId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper || paper.instituteId !== instituteId) throw new NotFoundException('Paper not found');

    if (paper.blueprintId !== exam.blueprintId) {
      throw new BadRequestException('Paper blueprint does not match Exam blueprint.');
    }

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { examId, status: PaperStatus.APPROVED },
    });

    return { message: 'Paper linked to Exam successfully.' };
  }

  // ── D-01: Submit Answer Sheet (Manual/OMR) ───────────────────────────────

  async createAnswerSheet(instituteId: string, examId: string, studentProfileId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    // Make sure student is in the batch for this exam
    const student = await this.prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
    if (!student || student.batchId !== exam.batchId) {
      throw new BadRequestException('Student does not belong to the exam batch');
    }

    return this.prisma.answerSheet.upsert({
      where: { examId_studentProfileId: { examId, studentProfileId } },
      create: {
        examId,
        studentProfileId,
        captureMode: exam.captureMode,
      },
      update: {},
    });
  }

  // ── D-01: Grade Answer Sheet (Question Level) ────────────────────────────

  async gradeAnswerSheet(
    instituteId: string,
    answerSheetId: string,
    dto: GradeAnswerSheetDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const answerSheet = await this.prisma.answerSheet.findUnique({
      where: { id: answerSheetId },
      include: { exam: true },
    });

    if (!answerSheet || answerSheet.exam.instituteId !== instituteId) {
      throw new NotFoundException('Answer Sheet not found');
    }

    // 04-DATABASE-SCHEMA.md: Response is immutable once the exam is LOCKED — an
    // admin must unlock() it first (EVALUATING) before grades can change again.
    if (answerSheet.exam.status === ExamStatus.LOCKED) {
      throw new ConflictException({
        code: 'EXAM_LOCKED',
        message: 'This exam is locked — an admin must unlock it before grades can change.',
      });
    }

    const { examId, studentProfileId } = answerSheet;

    const paper = await this.prisma.paper.findFirst({
      where: { examId, isPersonalized: false },
      include: { items: { include: { question: true } } },
    });

    if (!paper) throw new NotFoundException('No paper associated with this exam.');

    let totalObtained = 0;
    let maxTotal = 0;
    const topicsToRecalculate = new Set<string>();

    await this.prisma.$transaction(async (tx) => {
      for (const response of dto.responses) {
        const item = paper.items.find(pi => pi.questionId === response.questionId);
        if (!item) continue;

        maxTotal += item.marks;
        totalObtained += response.marksAwarded;
        topicsToRecalculate.add(item.question.topicId);

        await tx.response.upsert({
          where: {
            answerSheetId_questionId: {
              answerSheetId,
              questionId: response.questionId,
            }
          },
          create: {
            answerSheetId,
            questionId: response.questionId,
            marksAwarded: response.marksAwarded,
            marksAvailable: item.marks,
            isCorrect: response.isCorrect,
            studentAnswer: response.studentAnswer,
            mistakeTags: response.mistakeTags ?? [],
            teacherComment: response.teacherComment,
          },
          update: {
            marksAwarded: response.marksAwarded,
            isCorrect: response.isCorrect,
            studentAnswer: response.studentAnswer,
            mistakeTags: response.mistakeTags ?? [],
            teacherComment: response.teacherComment,
          },
        });
      }

      // Update Score Record
      const percentage = maxTotal > 0 ? (totalObtained / maxTotal) * 100 : 0;
      await tx.scoreRecord.upsert({
        where: { examId_studentProfileId: { examId, studentProfileId } },
        create: {
          examId,
          studentProfileId,
          totalMarks: maxTotal,
          obtainedMarks: totalObtained,
          percentage,
          evaluatedByUserId: actor.id,
          evaluatedAt: new Date(),
          isFinalized: true,
        },
        update: {
          totalMarks: maxTotal,
          obtainedMarks: totalObtained,
          percentage,
          evaluatedByUserId: actor.id,
          evaluatedAt: new Date(),
          isFinalized: true,
        },
      });

      // Mark answer sheet as verified
      await tx.answerSheet.update({
        where: { id: answerSheetId },
        data: {
          isVerified: true,
          verifiedByUserId: actor.id,
          verifiedAt: new Date(),
        },
      });
    });

    // Async trigger: Analytics Engine (D-02) — queued (mastery-recalc), not a raw
    // in-process fire-and-forget, so it retries on failure instead of silently
    // dropping the recalculation. Grading write itself stays fast (11-PERFORMANCE-
    // REQUIREMENTS.md); enqueueing is a fast Redis write, not the recalculation itself.
    await this.analyticsService.enqueueMasteryRecalc(studentProfileId, Array.from(topicsToRecalculate));

    return { message: 'Answer sheet graded and finalized. Analytics updated.' };
  }

  // ── Results: per-student scores + per-question stats for the Teacher UI ──

  async getResults(instituteId: string, examId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    if (teacherBatchIds !== null && !teacherBatchIds.includes(exam.batchId)) {
      throw new ForbiddenException('You can only view results for batches you are assigned to.');
    }

    const [scoreRecords, answerSheets] = await Promise.all([
      this.prisma.scoreRecord.findMany({
        where: { examId },
        include: { studentProfile: { include: { user: { select: { name: true } } } } },
        orderBy: { obtainedMarks: 'desc' },
      }),
      this.prisma.answerSheet.findMany({
        where: { examId },
        include: {
          responses: {
            include: {
              question: { select: { id: true, difficulty: true, content: true, topic: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    const students = scoreRecords.map((s) => ({
      studentProfileId: s.studentProfileId,
      name: s.studentProfile.user.name,
      obtainedMarks: s.obtainedMarks,
      totalMarks: s.totalMarks,
      percentage: s.percentage,
      isFinalized: s.isFinalized,
    }));

    const byQuestion = new Map<string, { questionId: string; topic: string; difficulty: string; content: string; correct: number; total: number }>();
    for (const sheet of answerSheets) {
      for (const r of sheet.responses) {
        if (!r.question) continue;
        const key = r.questionId;
        const entry = byQuestion.get(key) ?? {
          questionId: key,
          topic: r.question.topic.name,
          difficulty: r.question.difficulty,
          content: r.question.content,
          correct: 0,
          total: 0,
        };
        entry.total += 1;
        if (r.isCorrect) entry.correct += 1;
        byQuestion.set(key, entry);
      }
    }
    const questionAnalysis = Array.from(byQuestion.values()).map((q) => ({
      ...q,
      correctPct: q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0,
    }));

    const finalized = scoreRecords.filter((s) => s.isFinalized);
    const avgScore = finalized.length > 0
      ? Math.round(finalized.reduce((sum, s) => sum + s.percentage, 0) / finalized.length)
      : 0;
    const topScore = finalized.length > 0 ? Math.round(Math.max(...finalized.map((s) => s.percentage))) : 0;

    return {
      summary: {
        participated: answerSheets.length,
        graded: finalized.length,
        avgScore,
        topScore,
      },
      students,
      questionAnalysis,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      // Audit-log failures must never block the underlying mutation (08-ERROR-HANDLING.md);
      // still log so a persistent failure is visible rather than silently disappearing.
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
