import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, ReportStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateReportDto, QueryReportsDto } from './dto/report.dto';
import { REPORT_GENERATION_QUEUE, ReportGenerationJobData } from './report-generation.constants';
import { enqueueDeduped, jobKey } from '../infrastructure/queue/enqueue';
import { StorageService } from '../infrastructure/storage/storage.service';
import { QUEUE_POLICY } from '../infrastructure/queue/queue-policy';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(REPORT_GENERATION_QUEUE) private readonly generationQueue: Queue<ReportGenerationJobData>,
  ) {}

  /**
   * Signed download URLs expire (5 minutes by default, S3 and the local
   * fallback alike), so the one the worker minted at completion time is dead
   * long before anyone clicks it — every finished report had a "View Report"
   * link that 503'd unless opened within five minutes of generation. The URL
   * is therefore re-minted per read instead of served from Report.fileUrl,
   * whose stored value only records *that* a file exists.
   *
   * No schema change needed: the key is fully derived from the report row,
   * exactly as report-generation.processor.ts derives it when uploading.
   */
  private async withFreshDownloadUrl<T extends { id: string; instituteId: string; status: ReportStatus; fileUrl: string | null }>(
    report: T,
  ): Promise<T> {
    if (report.status !== ReportStatus.COMPLETE) return report;
    const key = this.storage.buildKey(report.instituteId, 'reports', `${report.id}.html`);
    return { ...report, fileUrl: await this.storage.getSignedDownloadUrl(key) };
  }

  // ── Report Generation (03-FEATURE-SPECIFICATIONS.md) ──────────────────────

  async requestReport(instituteId: string, dto: CreateReportDto, actor: AuthenticatedUser) {
    if (actor.role === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot generate reports.');
    }
    this.assertInstituteAccess(actor, instituteId);

    if (actor.role === UserRole.TEACHER && dto.scope.batchId) {
      await this.assertTeacherOwnsBatch(actor, dto.scope.batchId);
    }

    const report = await this.prisma.report.create({
      data: {
        instituteId,
        type: dto.type,
        scope: dto.scope as any,
        format: dto.format ?? 'PDF',
        status: ReportStatus.QUEUED,
        requestedByUserId: actor.id,
      },
    });

    try {
      await enqueueDeduped(
        this.generationQueue,
        'generate',
        { reportId: report.id },
        jobKey('report', report.id),
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.reportGeneration.jobOptions },
        this.logger,
      );
    } catch (err) {
      // The Report row is already committed, so a failed enqueue would otherwise
      // leave it QUEUED forever with no worker ever picking it up — indis-
      // tinguishable, to the person waiting, from one that is merely slow.
      // Mark it FAILED and say so, rather than reporting success for work that
      // will never run.
      this.logger.error(`Report ${report.id} could not be queued: ${(err as Error).message}`);
      await this.prisma.report
        .update({ where: { id: report.id }, data: { status: ReportStatus.FAILED } })
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        'Report generation is temporarily unavailable — the job queue is not reachable. Please try again shortly.',
      );
    }

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'reports', report.id, null, {
      type: report.type, scope: dto.scope,
    });

    return report;
  }

  async findById(instituteId: string, reportId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.instituteId !== instituteId) throw new NotFoundException('Report not found.');

    if (actor.role === UserRole.TEACHER && report.requestedByUserId !== actor.id) {
      throw new ForbiddenException('You can only view reports you requested.');
    }

    return this.withFreshDownloadUrl(report);
  }

  async findAll(instituteId: string, query: QueryReportsDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { instituteId };
    if (actor.role === UserRole.TEACHER) {
      where.requestedByUserId = actor.id;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: await Promise.all(reports.map((r) => this.withFreshDownloadUrl(r))),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 31-EVALUATION-AUDIT-VERSIONING.md §4: a post-dispute score correction
   * reissues an updated Report rather than silently replacing the original
   * — both remain retrievable. Called by EvaluationsService.override() after
   * a REVIEWER EvaluationVersion is created. Only reissues COMPLETE reports
   * scoped to this exact student (Report.scope is a flexible JSON shape;
   * matching narrowly on studentId is the honest, doc-example-matching case
   * — "a Report Card correction request" — not a general re-derivation of
   * every report format's applicability).
   */
  async reissueForStudent(instituteId: string, studentProfileId: string, actorId: string): Promise<void> {
    const affected = await this.prisma.report.findMany({
      where: {
        instituteId,
        status: ReportStatus.COMPLETE,
        scope: { path: ['studentId'], equals: studentProfileId },
        supersededBy: null, // don't re-reissue a report that's already been superseded
      },
    });

    for (const original of affected) {
      const reissue = await this.prisma.report.create({
        data: {
          instituteId,
          type: original.type,
          scope: original.scope as any,
          format: original.format,
          status: ReportStatus.QUEUED,
          requestedByUserId: actorId,
          supersedesReportId: original.id,
        },
      });
      await enqueueDeduped(this.generationQueue, 'generate', { reportId: reissue.id }, jobKey('report', reissue.id), { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.reportGeneration.jobOptions }, this.logger);
      await this.writeAudit(instituteId, actorId, AuditAction.CREATE, 'reports', reissue.id, { supersedes: original.id }, { type: original.type });
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertTeacherOwnsBatch(actor: AuthenticatedUser, batchId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
    const assignment = teacherProfile
      ? await this.prisma.batchTeacher.findFirst({ where: { teacherProfileId: teacherProfile.id, batchId, removedAt: null } })
      : null;
    if (!assignment) {
      throw new ForbiddenException('You can only generate reports for batches you are assigned to.');
    }
  }

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
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
