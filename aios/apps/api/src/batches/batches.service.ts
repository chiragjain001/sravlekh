import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateBatchDto,
  UpdateBatchDto,
  CreateSubjectDto,
  CreateChapterDto,
  CreateTopicDto,
  UpdateSubjectDto,
  UpdateChapterDto,
  UpdateTopicDto,
} from './dto/batch.dto';

// 09-CACHING-STRATEGY.md §1.1 / §3
const ACADEMICS_TREE_TTL_SECONDS = 30 * 60;
const academicsTreeKey = (instituteId: string) => `academics-tree:${instituteId}`;

@Injectable()
export class BatchesService {
  private readonly logger = new Logger(BatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── B-04: Batches CRUD ────────────────────────────────────────────────────

  async createBatch(instituteId: string, dto: CreateBatchDto, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);

    const batch = await this.prisma.batch.create({
      data: {
        instituteId,
        branchId: dto.branchId,
        name: dto.name,
        classYear: dto.classYear,
        section: dto.section,
        academicYear: dto.academicYear,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'batches', batch.id, null, dto);
    return batch;
  }

  async findAllBatches(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    return this.prisma.batch.findMany({
      where: { instituteId },
      include: {
        _count: { select: { students: true, teachers: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findBatchById(instituteId: string, batchId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        students: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          take: 50,
        },
        teachers: {
          where: { removedAt: null },
          include: {
            teacherProfile: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        branch: true,
      },
    });

    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found.');
    }

    return batch;
  }

  async updateBatch(
    instituteId: string,
    batchId: string,
    dto: UpdateBatchDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);

    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.instituteId !== instituteId) throw new NotFoundException('Batch not found.');

    const updated = await this.prisma.batch.update({
      where: { id: batchId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.classYear !== undefined && { classYear: dto.classYear }),
        ...(dto.section !== undefined && { section: dto.section }),
        ...(dto.academicYear !== undefined && { academicYear: dto.academicYear }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'batches', batchId, batch, dto);
    return updated;
  }

  // ── Curriculum: Subjects ──────────────────────────────────────────────────

  async createSubject(instituteId: string, dto: CreateSubjectDto, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);

    const existing = await this.prisma.subject.findUnique({
      where: { instituteId_name: { instituteId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Subject "${dto.name}" already exists.`);

    const subject = await this.prisma.subject.create({
      data: { instituteId, name: dto.name, code: dto.code },
    });
    await this.cache.del(academicsTreeKey(instituteId));
    return subject;
  }

  async findAllSubjects(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const cacheKey = academicsTreeKey(instituteId);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tree = await this.prisma.subject.findMany({
      where: { instituteId, deletedAt: null },
      include: {
        chapters: {
          where: { deletedAt: null },
          include: { topics: { where: { deletedAt: null }, orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    await this.cache.set(cacheKey, tree, ACADEMICS_TREE_TTL_SECONDS);
    return tree;
  }

  async updateSubject(
    instituteId: string,
    subjectId: string,
    dto: UpdateSubjectDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);
    const subject = await this.assertSubjectBelongsToInstitute(subjectId, instituteId);

    if (dto.name && dto.name !== subject.name) {
      const existing = await this.prisma.subject.findUnique({
        where: { instituteId_name: { instituteId, name: dto.name } },
      });
      if (existing && existing.id !== subjectId) {
        throw new ConflictException(`Subject "${dto.name}" already exists.`);
      }
    }

    const updated = await this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'subjects', subjectId, subject, dto);
    await this.cache.del(academicsTreeKey(instituteId));
    return updated;
  }

  /** Soft-delete only — a Subject may have Questions/MasteryScores/Blueprints attached
   * that must never be hard-cascade-deleted (18-EDGE-CASES.md: archive, not hard-delete). */
  async archiveSubject(instituteId: string, subjectId: string, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);
    const subject = await this.assertSubjectBelongsToInstitute(subjectId, instituteId);

    const archived = await this.prisma.subject.update({
      where: { id: subjectId },
      data: { deletedAt: new Date() },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.DELETE, 'subjects', subjectId, subject, null);
    await this.cache.del(academicsTreeKey(instituteId));
    return archived;
  }

  // ── Curriculum: Chapters ──────────────────────────────────────────────────

  async createChapter(
    instituteId: string,
    subjectId: string,
    dto: CreateChapterDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);
    await this.assertSubjectBelongsToInstitute(subjectId, instituteId);

    const chapter = await this.prisma.chapter.create({
      data: { subjectId, name: dto.name, order: dto.order ?? 0 },
    });
    await this.cache.del(academicsTreeKey(instituteId));
    return chapter;
  }

  async updateChapter(
    instituteId: string,
    chapterId: string,
    dto: UpdateChapterDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);
    const chapter = await this.assertChapterBelongsToInstitute(chapterId, instituteId);

    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'chapters', chapterId, chapter, dto);
    await this.cache.del(academicsTreeKey(instituteId));
    return updated;
  }

  async archiveChapter(instituteId: string, chapterId: string, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);
    const chapter = await this.assertChapterBelongsToInstitute(chapterId, instituteId);

    const archived = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { deletedAt: new Date() },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.DELETE, 'chapters', chapterId, chapter, null);
    await this.cache.del(academicsTreeKey(instituteId));
    return archived;
  }

  // ── Curriculum: Topics ────────────────────────────────────────────────────

  async createTopic(
    instituteId: string,
    chapterId: string,
    dto: CreateTopicDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);
    await this.assertChapterBelongsToInstitute(chapterId, instituteId);

    const topic = await this.prisma.topic.create({
      data: { chapterId, name: dto.name, order: dto.order ?? 0 },
    });
    await this.cache.del(academicsTreeKey(instituteId));
    return topic;
  }

  async updateTopic(
    instituteId: string,
    topicId: string,
    dto: UpdateTopicDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);
    const topic = await this.assertTopicBelongsToInstitute(topicId, instituteId);

    const updated = await this.prisma.topic.update({
      where: { id: topicId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'topics', topicId, topic, dto);
    await this.cache.del(academicsTreeKey(instituteId));
    return updated;
  }

  async archiveTopic(instituteId: string, topicId: string, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);
    const topic = await this.assertTopicBelongsToInstitute(topicId, instituteId);

    const archived = await this.prisma.topic.update({
      where: { id: topicId },
      data: { deletedAt: new Date() },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.DELETE, 'topics', topicId, topic, null);
    await this.cache.del(academicsTreeKey(instituteId));
    return archived;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertAdminAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.role !== UserRole.ADMIN || actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async assertSubjectBelongsToInstitute(subjectId: string, instituteId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.instituteId !== instituteId || subject.deletedAt) {
      throw new NotFoundException('Subject not found in this institute.');
    }
    return subject;
  }

  private async assertChapterBelongsToInstitute(chapterId: string, instituteId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { subject: true },
    });
    if (!chapter || chapter.subject.instituteId !== instituteId || chapter.deletedAt) {
      throw new NotFoundException('Chapter not found in this institute.');
    }
    return chapter;
  }

  private async assertTopicBelongsToInstitute(topicId: string, instituteId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { chapter: { include: { subject: true } } },
    });
    if (!topic || topic.chapter.subject.instituteId !== instituteId || topic.deletedAt) {
      throw new NotFoundException('Topic not found in this institute.');
    }
    return topic;
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
          instituteId, actorId, action, entity, entityId,
          oldValue: oldValue ? (oldValue as object) : undefined,
          newValue: newValue ? (newValue as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Audit log write failed', err);
    }
  }
}
