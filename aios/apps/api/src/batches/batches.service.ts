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
import { getTeacherBatchIds } from '../shared/teacher-scope';
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

    // A teacher only sees batches they're assigned to — everyone else (ADMIN/
    // FOUNDER) keeps institute-wide visibility, unaffected by this branch.
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);

    return this.prisma.batch.findMany({
      where: {
        instituteId,
        ...(teacherBatchIds !== null && { id: { in: teacherBatchIds } }),
      },
      include: {
        // Archived students are excluded from their batch's roster count —
        // students.findAll and the dashboard cards already hide them, so an
        // unfiltered count made the batch list disagree with the roster it
        // links to.
        _count: { select: { students: { where: { user: { status: 'ACTIVE' } } }, teachers: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findBatchById(instituteId: string, batchId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.assertTeacherOwnsBatchIfTeacher(actor, batchId);

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

  // ── Archive (soft-delete via the existing isActive flag) ──────────────────

  async archiveBatch(instituteId: string, batchId: string, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);

    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.instituteId !== instituteId) throw new NotFoundException('Batch not found.');
    if (!batch.isActive) throw new ConflictException('Batch is already archived.');

    await this.prisma.batch.update({ where: { id: batchId }, data: { isActive: false } });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'batches', batchId, { isActive: true }, { isActive: false });

    return { message: 'Batch archived successfully.' };
  }

  // ── Roster stats — real aggregates for the Admin overview/analytics screens ─

  async getStats(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    const where: Record<string, unknown> = {
      instituteId,
      ...(teacherBatchIds !== null && { id: { in: teacherBatchIds } }),
    };

    const [total, active, batches] = await Promise.all([
      this.prisma.batch.count({ where }),
      this.prisma.batch.count({ where: { ...where, isActive: true } }),
      this.prisma.batch.findMany({
        where,
        select: { id: true, name: true, classYear: true, _count: { select: { students: { where: { user: { status: 'ACTIVE' } } } } } },
      }),
    ]);

    const byClassYear = new Map<string, number>();
    for (const b of batches) {
      const key = b.classYear ?? 'Unspecified';
      byClassYear.set(key, (byClassYear.get(key) ?? 0) + 1);
    }

    return {
      total,
      active,
      inactive: total - active,
      byClassYear: Array.from(byClassYear.entries()).map(([classYear, count]) => ({ classYear, count })),
      byEnrollment: batches
        .map((b) => ({ batchId: b.id, batchName: b.name, studentCount: b._count.students }))
        .sort((a, b) => b.studentCount - a.studentCount)
        .slice(0, 10),
    };
  }

  // ── Batch performance: per-student aggregation for the Teacher UI ─────────
  // (avgScore/rank/status/trend have no direct column anywhere — they're
  // derived here from ScoreRecord, never fabricated).

  async getBatchPerformance(instituteId: string, batchId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.assertTeacherOwnsBatchIfTeacher(actor, batchId);

    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.instituteId !== instituteId) throw new NotFoundException('Batch not found.');

    const students = await this.prisma.studentProfile.findMany({
      where: { batchId },
      include: { user: { select: { name: true } } },
    });

    const scoreRecords = students.length > 0 ? await this.prisma.scoreRecord.findMany({
      where: { studentProfileId: { in: students.map((s) => s.id) }, isFinalized: true },
      include: { exam: { select: { id: true, scheduledDate: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    }) : [];

    const byStudent = new Map<string, typeof scoreRecords>();
    for (const r of scoreRecords) {
      const list = byStudent.get(r.studentProfileId) ?? [];
      list.push(r);
      byStudent.set(r.studentProfileId, list);
    }

    const ranked = students
      .map((s) => {
        const records = byStudent.get(s.id) ?? [];
        const avgScore = records.length > 0
          ? Math.round(records.reduce((sum, r) => sum + r.percentage, 0) / records.length)
          : null;
        const last = records[0];
        const status = avgScore === null ? 'unscored' : avgScore >= 75 ? 'excellent' : avgScore >= 60 ? 'average' : 'weak';
        return {
          id: s.id,
          name: s.user.name,
          rollNumber: s.rollNumber,
          avgScore: avgScore ?? 0,
          lastTestScore: last?.obtainedMarks ?? null,
          lastTestMax: last?.totalMarks ?? null,
          status,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));

    const scored = ranked.filter((s) => s.status !== 'unscored');
    const batchAvgScore = scored.length > 0 ? Math.round(scored.reduce((sum, s) => sum + s.avgScore, 0) / scored.length) : 0;

    const byExam = new Map<string, { sum: number; count: number; date: Date }>();
    for (const r of scoreRecords) {
      if (!r.examId) continue;
      const date = r.exam?.scheduledDate ?? r.exam?.createdAt ?? r.createdAt;
      const entry = byExam.get(r.examId) ?? { sum: 0, count: 0, date };
      entry.sum += r.percentage;
      entry.count += 1;
      byExam.set(r.examId, entry);
    }
    const examAverages = Array.from(byExam.values())
      .map((e) => ({ avg: e.sum / e.count, date: e.date }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    let trend: 'up' | 'down' | 'stable' = 'stable';
    const [mostRecent, previous] = examAverages;
    if (mostRecent && previous) {
      const diff = mostRecent.avg - previous.avg;
      trend = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';
    }

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        classYear: batch.classYear,
        section: batch.section,
        studentCount: students.length,
        avgScore: batchAvgScore,
        trend,
      },
      students: ranked,
    };
  }

  /**
   * Headline performance for every batch the caller can see, in one request.
   *
   * The dashboards that show a card per class used to call
   * getBatchPerformance() once per batch — nine requests and eighteen queries
   * for a nine-section school, on a screen that only reads studentCount,
   * avgScore and trend off each result. This computes the same three numbers
   * for all batches with two queries total, and deliberately omits the ranked
   * per-student list: a caller that needs that is looking at one batch and
   * should fetch that batch.
   */
  async getBatchPerformanceSummaries(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    const batches = await this.prisma.batch.findMany({
      where: {
        instituteId,
        ...(teacherBatchIds !== null && { id: { in: teacherBatchIds } }),
      },
      select: { id: true, name: true, classYear: true, section: true },
      orderBy: { name: 'asc' },
    });
    if (batches.length === 0) return [];

    const batchIds = batches.map((b) => b.id);
    const students = await this.prisma.studentProfile.findMany({
      where: { batchId: { in: batchIds } },
      select: { id: true, batchId: true },
    });

    const scoreRecords = students.length > 0
      ? await this.prisma.scoreRecord.findMany({
          where: { studentProfileId: { in: students.map((s) => s.id) }, isFinalized: true },
          select: {
            studentProfileId: true, percentage: true, examId: true, createdAt: true,
            exam: { select: { scheduledDate: true, createdAt: true } },
          },
        })
      : [];

    const batchOfStudent = new Map(students.map((s) => [s.id, s.batchId]));
    const perBatch = new Map<string, { scores: Map<string, { sum: number; n: number }>; byExam: Map<string, { sum: number; n: number; date: Date }> }>();
    for (const id of batchIds) perBatch.set(id, { scores: new Map(), byExam: new Map() });

    for (const r of scoreRecords) {
      const batchId = batchOfStudent.get(r.studentProfileId);
      const bucket = batchId ? perBatch.get(batchId) : undefined;
      if (!bucket) continue;

      const s = bucket.scores.get(r.studentProfileId) ?? { sum: 0, n: 0 };
      s.sum += r.percentage;
      s.n += 1;
      bucket.scores.set(r.studentProfileId, s);

      if (r.examId) {
        const date = r.exam?.scheduledDate ?? r.exam?.createdAt ?? r.createdAt;
        const e = bucket.byExam.get(r.examId) ?? { sum: 0, n: 0, date };
        e.sum += r.percentage;
        e.n += 1;
        bucket.byExam.set(r.examId, e);
      }
    }

    const studentCounts = new Map<string, number>();
    for (const s of students) studentCounts.set(s.batchId!, (studentCounts.get(s.batchId!) ?? 0) + 1);

    return batches.map((batch) => {
      const bucket = perBatch.get(batch.id)!;

      // Same shape as getBatchPerformance: average the per-student averages,
      // counting only students who actually have a finalized score.
      const studentAverages = [...bucket.scores.values()].map((s) => Math.round(s.sum / s.n));
      const avgScore = studentAverages.length > 0
        ? Math.round(studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length)
        : 0;

      const examAverages = [...bucket.byExam.values()]
        .map((e) => ({ avg: e.sum / e.n, date: e.date }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      const [mostRecent, previous] = examAverages;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (mostRecent && previous) {
        const diff = mostRecent.avg - previous.avg;
        trend = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';
      }

      return {
        id: batch.id,
        name: batch.name,
        classYear: batch.classYear,
        section: batch.section,
        studentCount: studentCounts.get(batch.id) ?? 0,
        avgScore,
        trend,
      };
    });
  }

  // Same "weak" cutoff BatchesService.getBatchPerformance and the frontend's
  // status buckets already use (avgScore < 60 -> weak).
  private static readonly WEAK_MASTERY_THRESHOLD = 0.6;

  async getWeakStudentsForTopic(instituteId: string, batchId: string, topicId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.assertTeacherOwnsBatchIfTeacher(actor, batchId);

    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.instituteId !== instituteId) throw new NotFoundException('Batch not found.');

    const scores = await this.prisma.masteryScore.findMany({
      where: {
        topicId,
        masteryValue: { lt: BatchesService.WEAK_MASTERY_THRESHOLD },
        studentProfile: { batchId },
      },
      include: { studentProfile: { include: { user: { select: { name: true } } } } },
      orderBy: { masteryValue: 'asc' },
    });

    return scores.map((s) => ({
      studentId: s.studentProfileId,
      name: s.studentProfile.user.name,
      batchId,
      avgInTopic: Math.round(s.masteryValue * 100),
    }));
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

  private async assertTeacherOwnsBatchIfTeacher(actor: AuthenticatedUser, batchId: string) {
    if (actor.role !== UserRole.TEACHER) return;
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    if (!teacherBatchIds?.includes(batchId)) {
      throw new ForbiddenException('You can only view batches you are assigned to.');
    }
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
