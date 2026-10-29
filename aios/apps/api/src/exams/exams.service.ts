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
import { CacheService } from '../infrastructure/cache/cache.service';
import {
  AuditAction,
  UserRole,
  ExamStatus,
  PaperStatus,
  Prisma,
  DeliveryStatus,
  NoticeChannel,
  AssessmentKind,
  StakesLevel,
  CaptureProviderType,
  EvaluationPolicyMode,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { EXAM_STATUS_TRANSITIONS as NEXT_STATUS } from '../shared/exam-status-transitions';
import { withVersionGuard } from '../shared/version-guard';
import { getTeacherBatchIds } from '../shared/teacher-scope';
import { assertAllAnswerSheetsVerified, assertNoUnevaluatedSubjectiveResponses } from '../shared/evaluation-lock-gate';
import {
  CreateExamDto,
  GradeAnswerSheetDto,
  ListExamsDto,
  UpdateExamStatusDto,
  UnlockExamDto,
  SelectOfficialPaperDto,
  RejectCandidatePaperDto,
  RequestChangesDto,
} from './dto/exam.dto';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly cache: CacheService,
  ) { }

  // ── D-01: Create Exam ────────────────────────────────────────────────────

  async createExam(instituteId: string, dto: CreateExamDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found');
    }

    let blueprintId = dto.blueprintId;
    let format = 'OMR';
    let duration = dto.durationMinutes ?? 120;

    let blueprint: any = null;
    if (blueprintId) {
      blueprint = await this.prisma.blueprint.findUnique({ where: { id: blueprintId } });
      if (!blueprint || blueprint.instituteId !== instituteId) {
        throw new NotFoundException('Blueprint not found');
      }
      format = (blueprint.format as string) || 'OMR';
      duration = dto.durationMinutes ?? blueprint.duration;
    } else {
      blueprint = await this.prisma.blueprint.findFirst({
        where: { instituteId, ...(dto.subjectId ? { subjectId: dto.subjectId } : {}) },
        orderBy: { createdAt: 'desc' },
      });
      if (!blueprint) {
        let subject = dto.subjectId
          ? await this.prisma.subject.findUnique({ where: { id: dto.subjectId } })
          : await this.prisma.subject.findFirst({ where: { instituteId } });
        if (!subject) {
          subject = await this.prisma.subject.create({
            data: {
              instituteId,
              name: 'General',
              code: 'GEN-01',
            },
          });
        }
        blueprint = await this.prisma.blueprint.create({
          data: {
            instituteId,
            subjectId: subject.id,
            name: `${dto.title} Pattern`,
            totalMarks: dto.totalMarks ?? 100,
            duration: dto.durationMinutes ?? 120,
            instructions: dto.instructions ?? 'General Examination Guidelines',
            distribution: [],
            createdByUserId: actor.id,
          },
        });
      }
      blueprintId = blueprint.id;
      format = (blueprint.format as string) || 'OMR';
    }

    if (dto.scheduledDate) {
      const scheduled = new Date(dto.scheduledDate);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (scheduled < startOfToday) {
        throw new BadRequestException('The exam date cannot be in the past — pick today or a later date.');
      }
    }

    // Canonical Bridge: ensure capture provider & evaluation policy exist for v2 pipeline
    let captureProvider = await this.prisma.captureProvider.findFirst({
      where: { instituteId },
    });
    if (!captureProvider) {
      captureProvider = await this.prisma.captureProvider.create({
        data: {
          instituteId,
          type: CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE,
          config: { autoProcess: false },
        },
      });
    }

    let evaluationPolicy = await this.prisma.evaluationPolicy.findFirst({
      where: { instituteId },
    });
    if (!evaluationPolicy) {
      evaluationPolicy = await this.prisma.evaluationPolicy.create({
        data: {
          instituteId,
          name: 'Default Policy — Mandatory Human Review',
          mode: EvaluationPolicyMode.AI_ASSIST_MANDATORY_REVIEW,
          requiresHumanReview: true,
        },
      });
    }

    const scheduledStart = dto.scheduledDate ? new Date(dto.scheduledDate) : null;
    const scheduledEnd = scheduledStart ? new Date(scheduledStart.getTime() + duration * 60000) : null;

    const exam = await this.prisma.$transaction(async (tx) => {
      // 1. Create canonical v2 Assessment
      const assessment = await tx.assessment.create({
        data: {
          instituteId,
          title: dto.title,
          assessmentKind: AssessmentKind.COACHING_TEST,
          stakesLevel: StakesLevel.GRADED,
          subjectIds: blueprint?.subjectId ? [blueprint.subjectId] : [],
          totalMarks: Number(blueprint?.totalMarks ?? dto.totalMarks ?? 100),
          createdByUserId: actor.id,
        },
      });

      // 2. Create canonical v2 AssessmentDelivery
      const delivery = await tx.assessmentDelivery.create({
        data: {
          assessmentId: assessment.id,
          batchId: dto.batchId,
          status: dto.status || ExamStatus.DRAFT,
          scheduledStart,
          scheduledEnd,
          captureProviderId: captureProvider.id,
          evaluationPolicyId: evaluationPolicy.id,
          createdByUserId: actor.id,
        },
      });

      // 3. Create v1 Exam mapped to the canonical AssessmentDelivery
      const createdExam = await tx.exam.create({
        data: {
          instituteId,
          batchId: dto.batchId,
          blueprintId: (blueprint?.id ?? blueprintId) as string,
          title: dto.title,
          type: dto.type,
          format: format as any,
          status: dto.status || ExamStatus.DRAFT,
          captureMode: dto.captureMode,
          scheduledDate: scheduledStart,
          durationMinutes: duration,
          venue: dto.venue,
          createdByUserId: actor.id,
          assessmentDeliveryId: delivery.id,
        },
      });

      return createdExam;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'exams', exam.id, null, { title: exam.title });

    return exam;
  }

  // ── D-01: List / Get Exams ───────────────────────────────────────────────

  async findAll(instituteId: string, actor: AuthenticatedUser, query: ListExamsDto = {}) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    // Teachers only see exams for their own batches — ADMIN/FOUNDER keep
    // institute-wide visibility, unaffected by this branch. Cache is passed so
    // repeated requests within 60s re-use the teacher's batch ID list from Redis
    // instead of issuing 2 extra DB queries on every call.
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);

    const scope = teacherBatchIds ? teacherBatchIds.slice().sort().join(',') : (actor.role === UserRole.STUDENT ? actor.id : 'all');
    const cacheKey = "exams:list:" + instituteId + ":" + scope + ":" + page + ":" + limit + ":" + (query.status ?? 'all') + ":" + (query.batchId ?? 'all');
    if (this.cache) {
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) return cached;
    }

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

    const where = {
      instituteId,
      ...(teacherBatchIds !== null && { batchId: { in: teacherBatchIds } }),
      ...(query.status && { status: query.status }),
      ...(query.batchId && !teacherBatchIds && { batchId: query.batchId }),
      ...(query.batchId && teacherBatchIds && {
        batchId: teacherBatchIds.includes(query.batchId) ? query.batchId : '__none__',
      }),
      ...studentWhere,
    };

    const [rawExams, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        include: {
          batch: { select: { id: true, name: true, classYear: true, section: true } },
          blueprint: { select: { id: true, name: true, totalMarks: true, subject: { select: { id: true, name: true } } } },
          // Students must NEVER receive candidate papers or internal reviews
          ...(actor.role !== UserRole.STUDENT && {
            papers: {
              select: {
                id: true,
                title: true,
                status: true,
                submittedAt: true,
                approvedAt: true,
                approvedByUserId: true,
                createdByUserId: true,
                createdAt: true,
                format: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.exam.count({ where }),
    ]);

    let data: any[] = rawExams;
    if (actor.role !== UserRole.STUDENT) {
      const allCreatorIds = Array.from(
        new Set(rawExams.flatMap((e: any) => (e.papers || []).map((p: any) => p.createdByUserId)).filter(Boolean)),
      );
      if (allCreatorIds.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { id: { in: allCreatorIds } },
          select: { id: true, name: true, email: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));
        data = rawExams.map((e: any) => ({
          ...e,
          papers: (e.papers || []).map((p: any) => ({
            ...p,
            creator: userMap.get(p.createdByUserId) ?? { id: p.createdByUserId, name: 'Teacher', email: '' },
          })),
        }));
      }
    }

    const result = {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
    if (this.cache) {
      await this.cache.set(cacheKey, result, 30);
    }
    return result;
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

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);
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
      if (exam.assessmentDeliveryId) {
        await assertNoUnevaluatedSubjectiveResponses(this.prisma, {
          attempt: { assessmentDeliveryId: exam.assessmentDeliveryId },
        });
      }
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
          ...(exam.assessmentDeliveryId
            ? [
              this.prisma.assessmentDelivery.update({
                where: { id: exam.assessmentDeliveryId },
                data: { status: ExamStatus.LOCKED, version: { increment: 1 } },
              }),
            ]
            : []),
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
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      const hasUnlock = await this.prisma.userPermissionGrant.findFirst({
        where: {
          userId: actor.id,
          permission: 'exam:unlock',
          OR: [{ batchId: null }, { batchId: exam.batchId }],
        },
      });
      if (!hasUnlock) {
        throw new ForbiddenException('Only admins or users with the exam:unlock permission can unlock a locked exam.');
      }
    }

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

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { examId, status: PaperStatus.APPROVED },
    });

    return { message: 'Paper linked to Exam successfully.' };
  }

  // ── D-01: Candidate Papers Workflow ───────────────────────────────────────

  async getCandidatePapers(instituteId: string, examId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    if (actor.role === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot access candidate papers.');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        batch: { select: { id: true, name: true } },
        blueprint: { select: { id: true, name: true, subject: { select: { id: true, name: true } } } },
      },
    });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);
    if (teacherBatchIds !== null && !teacherBatchIds.includes(exam.batchId)) {
      throw new ForbiddenException('You can only view exams for your assigned batches.');
    }

    const papers = await this.prisma.paper.findMany({
      where: {
        instituteId,
        examId,
        ...(actor.role === UserRole.TEACHER && { createdByUserId: actor.id }),
      },
      include: {
        items: {
          select: { id: true, marks: true, order: true },
        },
        blueprint: {
          select: { totalMarks: true, duration: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = Array.from(new Set(papers.map((p) => p.createdByUserId).filter(Boolean)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return papers.map((p) => ({
      ...p,
      creator: userMap.get(p.createdByUserId) ?? { id: p.createdByUserId, name: 'Teacher', email: '' },
      totalQuestions: p.items.length,
      totalMarks: p.items.reduce((s, i) => s + (i.marks || 0), 0) || p.blueprint?.totalMarks || 0,
    }));
  }

  async submitCandidatePaper(instituteId: string, examId: string, paperId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    if (actor.role === UserRole.STUDENT) throw new ForbiddenException('Students cannot submit papers.');

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper || paper.instituteId !== instituteId) throw new NotFoundException('Paper not found');

    if (actor.role === UserRole.TEACHER && paper.createdByUserId !== actor.id) {
      throw new ForbiddenException('You can only submit your own papers.');
    }

    await this.prisma.paper.update({
      where: { id: paperId },
      data: {
        examId,
        status: PaperStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    if (exam.status === ExamStatus.DRAFT) {
      await this.prisma.exam.update({
        where: { id: examId },
        data: { status: ExamStatus.REVIEW, version: { increment: 1 } },
      });
    }

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'papers', paperId, { status: paper.status }, { status: 'SUBMITTED', examId });

    return { message: 'Candidate paper submitted successfully.' };
  }

  async selectOfficialPaper(instituteId: string, examId: string, dto: SelectOfficialPaperDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can select and approve an official exam paper.');
    }

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const selectedPaper = await this.prisma.paper.findUnique({ where: { id: dto.paperId } });
    if (!selectedPaper || selectedPaper.instituteId !== instituteId) throw new NotFoundException('Paper not found');

    if (selectedPaper.examId !== examId) {
      throw new BadRequestException('Selected paper does not belong to this exam.');
    }

    const otherCandidatePapers = await this.prisma.paper.findMany({
      where: {
        examId,
        id: { not: dto.paperId },
        status: { in: [PaperStatus.SUBMITTED, PaperStatus.APPROVED] },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.paper.update({
        where: { id: dto.paperId },
        data: {
          status: PaperStatus.APPROVED,
          approvedAt: new Date(),
          approvedByUserId: actor.id,
        },
      });

      if (otherCandidatePapers.length > 0) {
        await tx.paper.updateMany({
          where: { id: { in: otherCandidatePapers.map((p) => p.id) } },
          data: { status: PaperStatus.ARCHIVED },
        });
      }

      const nextStatus = (exam.status === ExamStatus.DRAFT || exam.status === ExamStatus.REVIEW)
        ? ExamStatus.APPROVED
        : exam.status;

      await tx.exam.update({
        where: { id: examId },
        data: {
          status: nextStatus,
          approvedAt: new Date(),
          approvedByUserId: actor.id,
          version: { increment: 1 },
        },
      });
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.APPROVE,
      'exams',
      examId,
      { previousStatus: exam.status },
      { officialPaperId: dto.paperId, comment: dto.comment },
    );

    // Send notifications to teachers
    await this.sendInAppNotification(
      instituteId,
      selectedPaper.createdByUserId,
      'Paper Approved as Official Paper',
      `Your "${exam.title}" paper has been approved and selected as the official examination paper.${dto.comment ? ` Note: ${dto.comment}` : ''}`,
      actor.id,
    );

    for (const other of otherCandidatePapers) {
      if (other.createdByUserId !== selectedPaper.createdByUserId) {
        await this.sendInAppNotification(
          instituteId,
          other.createdByUserId,
          'Candidate Paper Status Update',
          `Your "${exam.title}" candidate paper was not selected for the official examination.${dto.comment ? ` Feedback: ${dto.comment}` : ''}`,
          actor.id,
        );
      }
    }

    return {
      message: 'Official paper selected and exam approved successfully.',
      officialPaperId: dto.paperId,
    };
  }

  async rejectCandidatePaper(instituteId: string, examId: string, paperId: string, dto: RejectCandidatePaperDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can reject candidate papers.');
    }

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper || paper.instituteId !== instituteId || paper.examId !== examId) throw new NotFoundException('Paper not found for this exam');

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { status: PaperStatus.ARCHIVED },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'papers', paperId, { status: paper.status }, { status: 'ARCHIVED', action: 'REJECT', reason: dto.reason });

    await this.sendInAppNotification(
      instituteId,
      paper.createdByUserId,
      'Candidate Paper Rejected',
      `Your candidate paper for "${exam.title}" was not accepted${dto.reason ? `: ${dto.reason}` : '.'}`,
      actor.id,
    );

    return { message: 'Candidate paper rejected.' };
  }

  async requestPaperChanges(instituteId: string, examId: string, paperId: string, dto: RequestChangesDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can request changes on candidate papers.');
    }

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper || paper.instituteId !== instituteId || paper.examId !== examId) throw new NotFoundException('Paper not found for this exam');

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { status: PaperStatus.DRAFT },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'papers', paperId, null, { status: 'DRAFT', feedback: dto.feedback });

    await this.sendInAppNotification(
      instituteId,
      paper.createdByUserId,
      'Changes Requested on Candidate Paper',
      `Changes requested on your "${exam.title}" paper: ${dto.feedback}`,
      actor.id,
    );

    return { message: 'Changes requested successfully.' };
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
  //
  // Performance rewrite (P0.4 from audit): the previous implementation fetched
  // ALL response rows for ALL students (200 students × 40 questions = 8,000+
  // rows) into Node.js memory and did the per-question aggregation there. This
  // version pushes the GROUP BY to PostgreSQL so only the aggregate result set
  // (one row per question) is transferred, regardless of student count.

  async getResults(instituteId: string, examId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found.');

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor, this.cache);
    if (teacherBatchIds !== null && !teacherBatchIds.includes(exam.batchId)) {
      throw new ForbiddenException('You can only view results for batches you are assigned to.');
    }

    // Per-student leaderboard — score records only, no response rows needed.
    const scoreRecords = await this.prisma.scoreRecord.findMany({
      where: { examId },
      include: { studentProfile: { include: { user: { select: { name: true } } } } },
      orderBy: { obtainedMarks: 'desc' },
    });

    const students = scoreRecords.map((s) => ({
      studentProfileId: s.studentProfileId,
      name: s.studentProfile.user.name,
      rollNumber: s.studentProfile.rollNumber ?? null,
      participationStatus: 'PARTICIPATED' as const,
      obtainedMarks: s.obtainedMarks,
      totalMarks: s.totalMarks,
      percentage: s.percentage,
      isFinalized: s.isFinalized,
    }));

    // Enrolled students in the batch — tracks participation, absence vs non-conduct
    const enrolledStudents = this.prisma.studentProfile
      ? await this.prisma.studentProfile.findMany({
        where: { batchId: exam.batchId },
        include: { user: { select: { name: true } } },
        orderBy: { rollNumber: 'asc' },
      })
      : [];

    const scoreMap = new Map(scoreRecords.map((s) => [s.studentProfileId, s]));

    let attendanceMap = new Map<string, string>();
    if (this.prisma.attendanceRecord && exam.scheduledDate) {
      const examDate = new Date(exam.scheduledDate);
      examDate.setUTCHours(0, 0, 0, 0);
      const records = await this.prisma.attendanceRecord.findMany({
        where: {
          batchId: exam.batchId,
          date: examDate,
        },
        select: { studentProfileId: true, status: true },
      });
      attendanceMap = new Map(records.map((r) => [r.studentProfileId, r.status]));
    }

    let absentCount = 0;
    let notAttemptedCount = 0;

    const studentParticipationList = enrolledStudents.map((st) => {
      const score = scoreMap.get(st.id);
      if (score) {
        return {
          studentProfileId: st.id,
          name: st.user.name,
          rollNumber: st.rollNumber,
          participationStatus: 'PARTICIPATED' as const,
          obtainedMarks: score.obtainedMarks,
          totalMarks: score.totalMarks,
          percentage: score.percentage,
          isFinalized: score.isFinalized,
        };
      }

      const attStatus = attendanceMap.get(st.id);
      let pStatus: 'ABSENT' | 'EXCUSED' | 'NOT_ATTEMPTED' = 'NOT_ATTEMPTED';
      if (attStatus === 'ABSENT' || attStatus === 'EXCUSED') {
        pStatus = attStatus;
        absentCount++;
      } else {
        notAttemptedCount++;
      }

      return {
        studentProfileId: st.id,
        name: st.user.name,
        rollNumber: st.rollNumber,
        participationStatus: pStatus,
        obtainedMarks: null,
        totalMarks: null,
        percentage: null,
        isFinalized: false,
      };
    });

    // Per-question correctness stats — aggregated in the DB, not in Node.js.
    // Returns one row per question: total attempts and correct count.
    type QuestionAggRow = {
      question_id: string;
      topic_name: string;
      difficulty: string;
      content: string;
      total: bigint;
      correct: bigint;
    };

    const questionRows = await this.prisma.$queryRaw<QuestionAggRow[]>`
      SELECT
        r."questionId" AS question_id,
        t.name AS topic_name,
        q.difficulty,
        q.content,
        COUNT(*) AS total,
        SUM(CASE WHEN r."isCorrect" THEN 1 ELSE 0 END) AS correct
      FROM responses r
      JOIN answer_sheets a ON a.id = r."answerSheetId"
      JOIN questions q ON q.id = r."questionId"
      JOIN topics t ON t.id = q."topicId"
      WHERE a."examId" = ${examId}
      GROUP BY r."questionId", t.name, q.difficulty, q.content
      ORDER BY r."questionId"
    `;

    const questionAnalysis = questionRows.map((row) => {
      const total = Number(row.total);
      const correct = Number(row.correct);
      return {
        questionId: row.question_id,
        topic: row.topic_name,
        difficulty: row.difficulty,
        content: row.content,
        total,
        correct,
        correctPct: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });

    const finalized = scoreRecords.filter((s) => s.isFinalized);
    const participatedCount = await this.prisma.answerSheet.count({ where: { examId } });
    const avgScore =
      finalized.length > 0
        ? Math.round(finalized.reduce((sum, s) => sum + s.percentage, 0) / finalized.length)
        : 0;
    const topScore =
      finalized.length > 0 ? Math.round(Math.max(...finalized.map((s) => s.percentage))) : 0;

    return {
      summary: {
        totalEnrolled: enrolledStudents.length > 0 ? enrolledStudents.length : participatedCount,
        participated: participatedCount,
        absent: absentCount,
        notAttempted: notAttemptedCount,
        graded: finalized.length,
        avgScore,
        topScore,
      },
      students: studentParticipationList.length > 0 ? studentParticipationList : students,
      questionAnalysis,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async sendInAppNotification(
    instituteId: string,
    recipientUserId: string,
    title: string,
    body: string,
    actorId: string,
  ) {
    try {
      const notice = await this.prisma.notice.create({
        data: {
          instituteId,
          createdByUserId: actorId,
          title,
          body,
          channels: [NoticeChannel.IN_APP],
          targetAudience: { userIds: [recipientUserId] } as any,
        },
      });
      await this.prisma.noticeDelivery.create({
        data: {
          noticeId: notice.id,
          userId: recipientUserId,
          channel: NoticeChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to send in-app notification to ${recipientUserId}`, err as Error);
    }
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
      if (this.cache && (entity === 'exams' || entity === 'papers')) {
        await this.cache.delByPrefix("exams:list:" + instituteId + ":");
      }
    } catch (err) {
      // Audit-log failures must never block the underlying mutation (08-ERROR-HANDLING.md);
      // still log so a persistent failure is visible rather than silently disappearing.
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
