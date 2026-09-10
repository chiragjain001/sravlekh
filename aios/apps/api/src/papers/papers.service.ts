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
          include: { question: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!paper || paper.instituteId !== instituteId) throw new NotFoundException('Paper not found.');

    return paper;
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
