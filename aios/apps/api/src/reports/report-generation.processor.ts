import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { ReportStatus } from '@prisma/client';
import { REPORT_GENERATION_QUEUE, ReportGenerationJobData } from './report-generation.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';

interface ReportScope {
  studentId?: string;
  batchId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Generates the report's underlying data from real DB records, tenant- and
 * batch-scoped, and renders it to a real, styled, printable HTML document
 * (a parent/teacher can open it directly or use the browser's own Print →
 * Save as PDF — no puppeteer/wkhtmltopdf-class dependency needed for that).
 * Previously uploaded raw JSON behind a "Download Report" button styled like
 * a finished document (audit-flagged) — the async job lifecycle, scope
 * validation, empty-data handling, and storage path were already real; only
 * the render format was a placeholder.
 */
@Processor(REPORT_GENERATION_QUEUE, workerOptions(QUEUE_POLICY.reportGeneration))
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
      const html = renderReportHtml(report.type, payload);
      const key = this.storage.buildKey(report.instituteId, 'reports', `${report.id}.html`);
      await this.storage.upload(key, Buffer.from(html, 'utf-8'), 'text/html');
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
    reportDeadLetter('report-generation', job, err, this.logger, { reportId: job?.data.reportId });
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

      // Phase 12 (docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md): ScoreRecord.examId was
      // loosened to optional so a v2-native Attempt can also own a ScoreRecord —
      // this report's "exam" column is still v1-Exam-shaped, so v2-native rows
      // (examId=null) are excluded here rather than crashing on a null exam
      // relation. Reporting on v2 attempts is a real, separate future increment.
      const scores = await this.prisma.scoreRecord.findMany({
        where: { studentProfileId: scope.studentId, examId: { not: null }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
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
        scores: scores
          .filter((s) => s.exam !== null)
          .map((s) => ({ exam: s.exam!.title, examType: s.exam!.type, percentage: s.percentage, obtainedMarks: s.obtainedMarks, totalMarks: s.totalMarks })),
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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPct(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value)}%`;
}

const REPORT_STYLES = `
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px 40px; background: #f8fafc; }
  .sheet { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px 36px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .note { margin-top: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; font-size: 13px; }
  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: none; } }
`;

/** Renders the report payload to a real, printable HTML document — a parent
 * or admin opens it directly, or uses the browser's Print → Save as PDF. */
function renderReportHtml(type: string, payload: any): string {
  const title = type.replace(/_/g, ' ');
  const generatedAt = new Date().toLocaleString();

  let body: string;
  if (payload.student) {
    body = `
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(payload.student.name)}${payload.student.rollNumber ? ` · Roll No. ${escapeHtml(payload.student.rollNumber)}` : ''}</p>
      <h3>Exam Scores</h3>
      ${payload.scores?.length ? `
        <table>
          <thead><tr><th>Exam</th><th>Type</th><th>Marks</th><th>Percentage</th></tr></thead>
          <tbody>${payload.scores.map((s: any) => `
            <tr><td>${escapeHtml(s.exam)}</td><td>${escapeHtml(s.examType)}</td><td>${escapeHtml(s.obtainedMarks)} / ${escapeHtml(s.totalMarks)}</td><td>${fmtPct(s.percentage)}</td></tr>
          `).join('')}</tbody>
        </table>` : '<p class="note">No exam scores in range.</p>'}
      <h3>Topic Mastery</h3>
      ${payload.mastery?.length ? `
        <table>
          <thead><tr><th>Subject</th><th>Topic</th><th>Mastery</th><th>Trend</th></tr></thead>
          <tbody>${payload.mastery.map((m: any) => `
            <tr><td>${escapeHtml(m.subject)}</td><td>${escapeHtml(m.topic)}</td><td>${fmtPct(m.masteryValue * 100)}</td><td>${m.trend > 0 ? '↑ improving' : m.trend < 0 ? '↓ declining' : '— stable'}</td></tr>
          `).join('')}</tbody>
        </table>` : '<p class="note">No mastery data yet.</p>'}
    `;
  } else if (payload.batch) {
    body = `
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(payload.batch.name)}</p>
      <table>
        <thead><tr><th>Student</th><th>Roll No.</th><th>Average %</th><th>Exams</th></tr></thead>
        <tbody>${payload.roster.map((r: any) => `
          <tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.rollNumber ?? '—')}</td><td>${fmtPct(r.averagePercentage)}</td><td>${escapeHtml(r.examCount)}</td></tr>
        `).join('')}</tbody>
      </table>
      ${payload.note ? `<p class="note">${escapeHtml(payload.note)}</p>` : ''}
    `;
  } else {
    body = `<h1>${escapeHtml(title)}</h1><p class="note">${escapeHtml(payload.note ?? 'No data available for this report.')}</p>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="sheet">
    ${body}
    <div class="footer">Generated by AIOS on ${escapeHtml(generatedAt)}</div>
  </div>
</body>
</html>`;
}
