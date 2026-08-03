import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateBatchDto,
  UpdateBatchDto,
  CreateSubjectDto,
  CreateChapterDto,
  CreateTopicDto,
} from './dto/batch.dto';

@Injectable()
export class BatchesService {
  private readonly logger = new Logger(BatchesService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.subject.create({
      data: { instituteId, name: dto.name, code: dto.code },
    });
  }

  async findAllSubjects(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    return this.prisma.subject.findMany({
      where: { instituteId },
      include: {
        chapters: {
          include: { topics: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
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

    return this.prisma.chapter.create({
      data: { subjectId, name: dto.name, order: dto.order ?? 0 },
    });
  }

  // ── Curriculum: Topics ────────────────────────────────────────────────────

  async createTopic(
    instituteId: string,
    chapterId: string,
    dto: CreateTopicDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { subject: true },
    });
    if (!chapter || chapter.subject.instituteId !== instituteId) {
      throw new NotFoundException('Chapter not found in this institute.');
    }

    return this.prisma.topic.create({
      data: { chapterId, name: dto.name, order: dto.order ?? 0 },
    });
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
    if (!subject || subject.instituteId !== instituteId) {
      throw new NotFoundException('Subject not found in this institute.');
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
