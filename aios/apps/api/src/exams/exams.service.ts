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
import { AuditAction, UserRole, ExamStatus, PaperStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateExamDto,
  GradeAnswerSheetDto,
  UpdateExamStatusDto,
  UnlockExamDto,
} from './dto/exam.dto';

/**
 * 01-PRODUCT-REQUIREMENTS.md / 03-FEATURE-SPECIFICATIONS.md: strict forward-only
 * state machine, one stage at a time, no skipping. The only backward transition is
 * the separate unlock() method (LOCKED -> EVALUATING, admin-only, reason required).
 */
const NEXT_STATUS: Record<ExamStatus, ExamStatus | null> = {
  [ExamStatus.DRAFT]: ExamStatus.REVIEW,
  [ExamStatus.REVIEW]: ExamStatus.APPROVED,
  [ExamStatus.APPROVED]: ExamStatus.PUBLISHED,
  [ExamStatus.PUBLISHED]: ExamStatus.ONGOING,
  [ExamStatus.ONGOING]: ExamStatus.EVALUATING,
  [ExamStatus.EVALUATING]: ExamStatus.LOCKED,
  [ExamStatus.LOCKED]: null,
};

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
    return this.prisma.exam.findMany({
      where: { instituteId },
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
        batch: { select: { id: true, name: true } },
        blueprint: { select: { id: true, name: true, totalMarks: true } },
        papers: { select: { id: true, title: true, status: true } },
      },
    });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');
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
      const [updated] = await this.prisma.$transaction([
        this.prisma.exam.update({ where: { id: examId }, data }),
        this.prisma.auditLog.create({
          data: {
            instituteId, actorId: actor.id, action: auditAction, entity: 'exams', entityId: examId,
            oldValue: { status: exam.status } as any, newValue: { status: dto.status } as any,
          },
        }),
      ]);
      return updated;
    }

    const updated = await this.prisma.exam.update({ where: { id: examId }, data });
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
    const [updated] = await this.prisma.$transaction([
      this.prisma.exam.update({
        where: { id: examId },
        data: { status: ExamStatus.EVALUATING, unlockReason: dto.reason, version: { increment: 1 } },
      }),
      this.prisma.auditLog.create({
        data: {
          instituteId, actorId: actor.id, action: AuditAction.UNLOCK, entity: 'exams', entityId: examId,
          oldValue: { status: ExamStatus.LOCKED } as any,
          newValue: { status: ExamStatus.EVALUATING, reason: dto.reason } as any,
        },
      }),
    ]);

    return updated;
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
