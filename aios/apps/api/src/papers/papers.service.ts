import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, PaperStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateBlueprintDto,
  GeneratePaperDto,
  BlueprintDistributionRuleDto,
  ManualReplaceItemDto,
  ClonePaperDto,
} from './dto/paper.dto';
import { sampleWithoutReplacement } from '../shared/random-sample';

@Injectable()
export class PapersService {
  private readonly logger = new Logger(PapersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Blueprints ──────────────────────────────────────────────────────────

  async createBlueprint(instituteId: string, dto: CreateBlueprintDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    // Validate sum of marks matches totalMarks
    const calculatedMarks = dto.distribution.reduce((acc, rule) => acc + (rule.count * rule.marksPerQuestion), 0);
    if (calculatedMarks !== dto.totalMarks) {
      throw new BadRequestException(`Distribution marks sum (${calculatedMarks}) does not match totalMarks (${dto.totalMarks})`);
    }

    const blueprint = await this.prisma.blueprint.create({
      data: {
        instituteId,
        subjectId: dto.subjectId,
        name: dto.name,
        totalMarks: dto.totalMarks,
        duration: dto.duration,
        instructions: dto.instructions,
        distribution: dto.distribution as any,
        createdByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'blueprints', blueprint.id, null, dto);

    return blueprint;
  }

  async findAllBlueprints(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    return this.prisma.blueprint.findMany({
      where: { instituteId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Paper Generator (C-02) ──────────────────────────────────────────────

  async generatePaper(instituteId: string, dto: GeneratePaperDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const blueprint = await this.prisma.blueprint.findUnique({
      where: { id: dto.blueprintId },
    });

    if (!blueprint || blueprint.instituteId !== instituteId) {
      throw new NotFoundException('Blueprint not found');
    }

    const rules = blueprint.distribution as unknown as BlueprintDistributionRuleDto[];
    const selectedQuestionIds: string[] = [];
    const paperItemsData: { questionId: string; marks: number; order: number }[] = [];
    
    let orderCounter = 1;

    // Candidates are fetched per rule and sampled in memory. That is a deliberate
    // trade, not an oversight: `rules` is a blueprint's distribution list (single
    // digits in practice), and each query is narrowed by topic + type + difficulty
    // and selects `id` only, so the working set is a few hundred ids per rule rather
    // than the whole bank. Revisit with a DB-side sample only if a real bank makes
    // the per-rule candidate set large — the previous TODO here implied a severity
    // the query shape does not actually have.
    for (const rule of rules) {
      const candidates = await this.prisma.question.findMany({
        where: {
          instituteId,
          topicId: rule.topicId,
          type: rule.type,
          difficulty: rule.difficulty,
          isApproved: true,
          // If personalized, we could prioritize questions the student hasn't seen or has failed previously
          id: { notIn: selectedQuestionIds }, 
        },
        select: { id: true },
      });

      if (candidates.length < rule.count) {
        throw new BadRequestException(
          `Not enough questions in bank for topic ${rule.topicId} (${rule.difficulty} ${rule.type}). Needed ${rule.count}, found ${candidates.length}.`
        );
      }

      // Uniform draw. This was `candidates.sort(() => 0.5 - Math.random())`, which
      // is not a shuffle — see sampleWithoutReplacement's comment for the measured
      // bias (first candidate picked 1.87x too often) and why it matters here.
      const selected = sampleWithoutReplacement(candidates, rule.count);

      for (const q of selected) {
        selectedQuestionIds.push(q.id);
        paperItemsData.push({
          questionId: q.id,
          marks: rule.marksPerQuestion,
          order: orderCounter++,
        });
      }
    }

    const paper = await this.prisma.$transaction(async (tx) => {
      const p = await tx.paper.create({
        data: {
          instituteId,
          blueprintId: dto.blueprintId,
          title: dto.title,
          status: PaperStatus.DRAFT,
          isPersonalized: !!dto.targetStudentId,
          targetStudentId: dto.targetStudentId,
          targetBatchId: dto.targetBatchId,
          createdByUserId: actor.id,
          items: {
            createMany: { data: paperItemsData },
          },
        },
      });

      // Create version 1 (Base version)
      await tx.paperVersion.create({
        data: {
          paperId: p.id,
          versionNo: 1,
          setLabel: 'Set A',
        },
      });

      return p;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'papers', paper.id, null, { title: dto.title });

    return paper;
  }

  // ── Retrieve Papers ──────────────────────────────────────────────────────

  async findAllPapers(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    return this.prisma.paper.findMany({
      where: { instituteId },
      select: { id: true, title: true, status: true, isPersonalized: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaper(instituteId: string, paperId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        blueprint: true,
        items: {
          // Topic name included alongside the question, not just topicId — a
          // teacher reviewing the generated paper (the "Paper" tab on an exam's
          // detail page) needs to see what each question is actually about, the
          // same context the Paper Builder's own Preview step already shows
          // before publishing.
          include: { question: { include: { topic: { select: { name: true } } } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!paper || paper.instituteId !== instituteId) throw new NotFoundException('Paper not found.');

    return paper;
  }

  /**
   * Copies a paper's CURRENT items — after whatever review/regenerate/manual
   * edits it went through — into a brand new Paper for one target batch.
   *
   * See ClonePaperDto's comment for why this exists instead of linking the
   * same paper twice: Paper.examId is a single scalar, so one paper can only
   * ever belong to one exam. Publishing a reviewed paper to several batches
   * therefore clones it once per batch — item-for-item, in the same order —
   * rather than asking generatePaper to draw again, which would give each
   * batch a different random paper from the same blueprint and silently
   * throw away everything the teacher just reviewed.
   */
  async clonePaper(instituteId: string, sourcePaperId: string, dto: ClonePaperDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const source = await this.prisma.paper.findUnique({
      where: { id: sourcePaperId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!source || source.instituteId !== instituteId) throw new NotFoundException('Paper not found.');
    if (source.items.length === 0) throw new BadRequestException('This paper has no questions yet — nothing to publish.');

    const clone = await this.prisma.$transaction(async (tx) => {
      const p = await tx.paper.create({
        data: {
          instituteId,
          blueprintId: source.blueprintId,
          title: dto.title,
          status: PaperStatus.DRAFT,
          isPersonalized: source.isPersonalized,
          targetBatchId: dto.targetBatchId,
          createdByUserId: actor.id,
          items: {
            createMany: {
              data: source.items.map((item) => ({
                questionId: item.questionId,
                marks: item.marks,
                order: item.order,
              })),
            },
          },
        },
      });

      await tx.paperVersion.create({ data: { paperId: p.id, versionNo: 1, setLabel: 'Set A' } });

      return p;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'papers', clone.id, null, { title: dto.title, clonedFrom: sourcePaperId });

    return clone;
  }

  // ── Item review (teacher rejects a generated question, before publishing) ──
  //
  // generatePaper() above picks the whole paper blind, in one shot, at the
  // moment the teacher clicks Publish — there was no point between "the LLM
  // picked these questions" and "students can see them" where a teacher could
  // reject one. The two methods below are that point: swap one item for a
  // fresh bank pick, or replace it with a question the teacher writes
  // themselves — both while the paper is still DRAFT, i.e. before anything is
  // published to students.

  /** Shared setup + guards for both replacement paths below. */
  private async loadEditableItem(instituteId: string, paperId: string, itemId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const item = await this.prisma.paperItem.findUnique({
      where: { id: itemId },
      include: { paper: true, question: true },
    });

    if (!item || item.paperId !== paperId || item.paper.instituteId !== instituteId) {
      throw new NotFoundException('Paper item not found.');
    }

    // A published paper is one students may already be sitting or have sat —
    // swapping a question under them after the fact would silently invalidate
    // whatever was graded or being attempted against the original. DRAFT is
    // the only status this paper occupies before /exams/link-paper makes it
    // live, so this blocks edits only once that boundary has been crossed.
    if (item.paper.status !== PaperStatus.DRAFT) {
      throw new BadRequestException('This paper has already been published and can no longer be edited.');
    }

    return item;
  }

  /**
   * Regenerates one item: picks a different approved question with the same
   * topic/type/difficulty as the one being replaced, excluding every question
   * already used elsewhere in this paper (not just this item) so a swap can
   * never introduce a duplicate.
   */
  async regeneratePaperItem(instituteId: string, paperId: string, itemId: string, actor: AuthenticatedUser) {
    const item = await this.loadEditableItem(instituteId, paperId, itemId, actor);

    const siblingQuestionIds = (
      await this.prisma.paperItem.findMany({ where: { paperId }, select: { questionId: true } })
    ).map((i) => i.questionId);

    const candidates = await this.prisma.question.findMany({
      where: {
        instituteId,
        topicId: item.question.topicId,
        type: item.question.type,
        difficulty: item.question.difficulty,
        isApproved: true,
        id: { notIn: siblingQuestionIds },
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      throw new BadRequestException(
        'No other approved question is available for this topic and difficulty yet — write your own instead, or add more to the bank.',
      );
    }

    const [replacement] = sampleWithoutReplacement(candidates, 1);

    const updated = await this.prisma.paperItem.update({
      where: { id: itemId },
      data: { questionId: replacement!.id },
      include: { question: { include: { topic: { select: { name: true } } } } },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'paper_items', itemId, { questionId: item.questionId }, { questionId: replacement!.id, reason: 'regenerated' });

    return updated;
  }

  /**
   * Replaces one item with a question the teacher writes themselves.
   *
   * isApproved mirrors questions.service.ts's own create() rule exactly —
   * TEACHER-authored questions are NOT auto-approved into the shared bank;
   * only ADMIN/FOUNDER are. That governance is about the bank's general
   * quality gate, not about this paper: the row is attached to THIS item via
   * direct assignment below, not drawn through generatePaper's
   * isApproved-only candidate query, so the teacher can use it in their own
   * exam immediately either way — approval only decides whether it can later
   * be picked up by someone else's blueprint too.
   */
  async replaceItemManually(
    instituteId: string,
    paperId: string,
    itemId: string,
    dto: ManualReplaceItemDto,
    actor: AuthenticatedUser,
  ) {
    const item = await this.loadEditableItem(instituteId, paperId, itemId, actor);

    const question = await this.prisma.question.create({
      data: {
        instituteId,
        subjectId: item.question.subjectId,
        chapterId: item.question.chapterId,
        topicId: item.question.topicId,
        type: dto.type ?? item.question.type,
        difficulty: dto.difficulty ?? item.question.difficulty,
        marks: dto.marks ?? item.marks,
        content: dto.content,
        options: dto.options as any,
        solution: dto.solution,
        isApproved: actor.role === UserRole.FOUNDER || actor.role === UserRole.ADMIN,
        createdByUserId: actor.id,
      },
    });

    const updated = await this.prisma.paperItem.update({
      where: { id: itemId },
      data: { questionId: question.id, marks: dto.marks ?? item.marks },
      include: { question: { include: { topic: { select: { name: true } } } } },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'paper_items', itemId, { questionId: item.questionId }, { questionId: question.id, reason: 'manual_replacement' });

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
