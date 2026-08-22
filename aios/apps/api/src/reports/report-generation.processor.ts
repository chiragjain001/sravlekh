import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { ReportStatus } from '@prisma/client';
import { REPORT_GENERATION_QUEUE, ReportGenerationJobData } from './report-generation.constants';

interface ReportScope {
  studentId?: string;
  batchId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Generates the report's underlying data from real DB records, tenant- and
 * batch-scoped, and uploads it to tenant-scoped storage. Produces a structured
 * JSON document rather than a rendered PDF/Excel file — no PDF/Excel-rendering
 * library exists in this project yet, and per-ReportType document layout
 * (REPORT_CARD vs PROGRESS_CARD vs CLASS_REPORT, etc.) is a separate,
 * larger scoping decision deferred to a dedicated pass (see docs/33). The
 * async job lifecycle, scope validation, empty-data handling, and storage
 * path are real; only the final render format is a placeholder.
 */
@Processor(REPORT_GENERATION_QUEUE)
export class ReportGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<ReportGenerationJobData>): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: job.data.reportId } });
    if (!report) return;

    await this.prisma.report.update({ where: { id: report.id }, data: { status: ReportStatus.PROCESSING } });

    try {
      const payload = await this.buildPayload(report.instituteId, report.type, report.scope as ReportScope);
      const key = this.storage.buildKey(report.instituteId, 'reports', `${report.id}.json`);
      await this.storage.upload(key, Buffer.from(JSON.stringify(payload, null, 2)), 'application/json');
      const fileUrl = await this.storage.getSignedDownloadUrl(key);

      await this.prisma.report.update({
        where: { id: report.id },
        data: { status: ReportStatus.COMPLETE, fileUrl, completedAt: new Date() },
      });
    } catch (err) {
      await this.prisma.report.update({ where: { id: report.id }, data: { status: ReportStatus.FAILED } });
      throw err; // rethrow so BullMQ's own retry/backoff still applies
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ReportGenerationJobData> | undefined, err: Error) {
    if (!job) return;
    this.logger.warn(`report-generation job ${job.id} failed for report ${job.data.reportId}: ${err.message}`);
  }

  private async buildPayload(instituteId: string, type: string, scope: ReportScope) {
    const dateFilter =
      scope.dateFrom || scope.dateTo
        ? { gte: scope.dateFrom ? new Date(scope.dateFrom) : undefined, lte: scope.dateTo ? new Date(scope.dateTo) : undefined }
        : undefined;

    if (scope.studentId) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: scope.studentId },
        include: { user: { select: { name: true, instituteId: true } } },
      });
      if (!student || student.user.instituteId !== instituteId) {
        return { type, scope, note: 'no data in range', reason: 'student_not_found' };
      }

      const scores = await this.prisma.scoreRecord.findMany({
        where: { studentProfileId: scope.studentId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { exam: { select: { title: true, type: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const mastery = await this.prisma.masteryScore.findMany({
        where: { studentProfileId: scope.studentId },
        include: { subject: { select: { name: true } }, topic: { select: { name: true } } },
      });

      return {
        type, scope,
        student: { name: student.user.name, rollNumber: student.rollNumber },
        scores: scores.map((s) => ({ exam: s.exam.title, examType: s.exam.type, percentage: s.percentage, obtainedMarks: s.obtainedMarks, totalMarks: s.totalMarks })),
        mastery: mastery.map((m) => ({ subject: m.subject.name, topic: m.topic.name, masteryValue: m.masteryValue, trend: m.trend })),
        ...(scores.length === 0 ? { note: 'no data in range' } : {}),
      };
    }

    if (scope.batchId) {
      const batch = await this.prisma.batch.findUnique({ where: { id: scope.batchId } });
      if (!batch || batch.instituteId !== instituteId) {
        return { type, scope, note: 'no data in range', reason: 'batch_not_found' };
      }

      const students = await this.prisma.studentProfile.findMany({
        where: { batchId: scope.batchId },
        include: {
          user: { select: { name: true } },
          scoreRecords: { where: dateFilter ? { createdAt: dateFilter } : undefined },
        },
      });

      const roster = students.map((s) => {
        const avg = s.scoreRecords.length
          ? s.scoreRecords.reduce((sum, r) => sum + r.percentage, 0) / s.scoreRecords.length
          : null;
        return { name: s.user.name, rollNumber: s.rollNumber, averagePercentage: avg, examCount: s.scoreRecords.length };
      });

      return {
        type, scope,
        batch: { name: batch.name },
        roster,
        ...(roster.every((r) => r.examCount === 0) ? { note: 'no data in range' } : {}),
      };
    }

    return { type, scope, note: 'no data in range', reason: 'no_scope_provided' };
  }
}
