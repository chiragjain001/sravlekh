import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  QueryQuestionsDto,
} from './dto/question.dto';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── C-01: Create Question ────────────────────────────────────────────────

  async create(instituteId: string, dto: CreateQuestionDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    // Verify curriculum linkage
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      include: { chapter: { include: { subject: true } } },
    });

    if (
      !topic ||
      topic.chapterId !== dto.chapterId ||
      topic.chapter.subjectId !== dto.subjectId ||
      topic.chapter.subject.instituteId !== instituteId
    ) {
      throw new NotFoundException('Invalid Subject/Chapter/Topic hierarchy.');
    }

    const question = await this.prisma.$transaction(async (tx) => {
      // 1. Create the question in draft/unapproved state
      const q = await tx.question.create({
        data: {
          instituteId,
          subjectId: dto.subjectId,
          chapterId: dto.chapterId,
          topicId: dto.topicId,
          type: dto.type,
          difficulty: dto.difficulty,
          marks: dto.marks,
          negativeMarks: dto.negativeMarks ?? 0,
          content: dto.content,
          options: dto.options ? (dto.options as any) : undefined,
          solution: dto.solution,
          sourceRef: dto.sourceRef,
          createdByUserId: actor.id,
          // If founder/admin creates, it can be auto-approved, otherwise false.
          isApproved: actor.role === UserRole.FOUNDER || actor.role === UserRole.ADMIN,
          approvedByUserId: (actor.role === UserRole.FOUNDER || actor.role === UserRole.ADMIN) ? actor.id : null,
          approvedAt: (actor.role === UserRole.FOUNDER || actor.role === UserRole.ADMIN) ? new Date() : null,
        },
      });

      // 2. Create version 1
      await tx.questionVersion.create({
        data: {
          questionId: q.id,
          versionNo: 1,
          content: q.content,
          options: q.options ? (q.options as any) : undefined,
          solution: q.solution,
          createdBy: actor.id,
        },
      });

      return q;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'questions', question.id, null, { type: dto.type, topicId: dto.topicId });

    return question;
  }

  // ── C-01: List Questions ─────────────────────────────────────────────────

  async findAll(instituteId: string, query: QueryQuestionsDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { instituteId };

    if (query.subjectId) where['subjectId'] = query.subjectId;
    if (query.chapterId) where['chapterId'] = query.chapterId;
    if (query.topicId) where['topicId'] = query.topicId;
    if (query.difficulty) where['difficulty'] = query.difficulty;
    if (query.type) where['type'] = query.type;
    if (query.isApproved !== undefined) where['isApproved'] = query.isApproved;

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          subject: { select: { name: true } },
          topic: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data: questions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── C-01: Get Single Question ────────────────────────────────────────────

  async findById(instituteId: string, questionId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        versions: { orderBy: { versionNo: 'desc' } },
      },
    });

    if (!question || question.instituteId !== instituteId) {
      throw new NotFoundException('Question not found.');
    }

    return question;
  }

  // ── C-01: Update Question (Versioning) ───────────────────────────────────

  async update(
    instituteId: string,
    questionId: string,
    dto: UpdateQuestionDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const existing = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
    });

    if (!existing || existing.instituteId !== instituteId) {
      throw new NotFoundException('Question not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Create new version if content/options/solution changed
      const contentChanged = dto.content !== undefined && dto.content !== existing.content;
      const optionsChanged = dto.options !== undefined && JSON.stringify(dto.options) !== JSON.stringify(existing.options);
      const solutionChanged = dto.solution !== undefined && dto.solution !== existing.solution;

      const needsNewVersion = contentChanged || optionsChanged || solutionChanged;
      
      let newVersionNo = existing.versions[0]?.versionNo ?? 1;

      if (needsNewVersion) {
        newVersionNo += 1;
        await tx.questionVersion.create({
          data: {
            questionId,
            versionNo: newVersionNo,
            content: dto.content ?? existing.content,
            options: dto.options ? (dto.options as any) : (existing.options ? (existing.options as any) : undefined),
            solution: dto.solution ?? existing.solution,
            createdBy: actor.id,
          },
        });
      }

      // If a teacher updates an approved question, it should probably return to draft state (unapproved)
      // unless an admin is editing it.
      let isApproved = existing.isApproved;
      if (needsNewVersion && actor.role === UserRole.TEACHER) {
        isApproved = false;
      }

      return tx.question.update({
        where: { id: questionId },
        data: {
          ...(dto.difficulty && { difficulty: dto.difficulty }),
          ...(dto.marks !== undefined && { marks: dto.marks }),
          ...(dto.negativeMarks !== undefined && { negativeMarks: dto.negativeMarks }),
          ...(dto.content && { content: dto.content }),
          ...(dto.options !== undefined && { options: dto.options as any }),
          ...(dto.solution !== undefined && { solution: dto.solution }),
          ...(dto.sourceRef !== undefined && { sourceRef: dto.sourceRef }),
          ...(needsNewVersion && actor.role === UserRole.TEACHER && { isApproved: false }),
        },
      });
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'questions', questionId, existing, dto);

    return updated;
  }

  // ── C-01: Approve Question ───────────────────────────────────────────────

  async approve(instituteId: string, questionId: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can approve questions.');
    }
    
    this.assertInstituteAccess(actor, instituteId);

    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.instituteId !== instituteId) throw new NotFoundException('Question not found.');

    if (question.isApproved) {
      return question; // already approved
    }

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        isApproved: true,
        approvedByUserId: actor.id,
        approvedAt: new Date(),
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.APPROVE, 'questions', questionId, null, { isApproved: true });

    return updated;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private async writeAudit(
    instituteId: string,
    actorId: string,
    action: AuditAction,
    entity: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId,
          action,
          entity,
          entityId,
          oldValue: oldValue ? (oldValue as object) : undefined,
          newValue: newValue ? (newValue as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Audit log write failed', err);
    }
  }
}
