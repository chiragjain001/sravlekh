import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { ReportStatus } from '@prisma/client';
import axios from 'axios';
import { REPORT_GENERATION_QUEUE, ReportGenerationJobData } from './report-generation.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';
import { renderReportExcel } from './report-excel.renderer';

interface ReportScope {
  studentId?: string;
  batchId?: string;
  teacherId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Generates the report's underlying data from real DB records, tenant- and
 * batch-scoped, and renders it to a real vector PDF, genuine XLSX workbook,
 * CSV spreadsheet data, or printable HTML document.
 */
@Processor(REPORT_GENERATION_QUEUE, workerOptions(QUEUE_POLICY.reportGeneration))
export class ReportGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ReportGenerationJobData>): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: job.data.reportId } });
    if (!report) return;

    await this.prisma.report.update({ where: { id: report.id }, data: { status: ReportStatus.PROCESSING } });

    try {
      const payload = await this.buildPayload(report.instituteId, report.type, report.scope as ReportScope);
      let fileBuffer: Buffer;
      let contentType: string;
      let fileExt: string;

      if (report.format === 'EXCEL') {
        fileBuffer = await renderReportExcel(report.type, payload, report.id);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExt = 'xlsx';
      } else if (report.format === 'CSV') {
        const csv = renderReportCsv(report.type, payload);
        fileBuffer = Buffer.from(csv, 'utf-8');
        contentType = 'text/csv';
        fileExt = 'csv';
      } else if (report.format === 'PDF') {
        fileBuffer = await this.renderReportPdf(report.type, payload, report.id);
        contentType = 'application/pdf';
        fileExt = 'pdf';
      } else {
        const html = renderReportHtml(report.type, payload, report.id);
        fileBuffer = Buffer.from(html, 'utf-8');
        contentType = 'text/html';
        fileExt = 'html';
      }

      const key = this.storage.buildKey(report.instituteId, 'reports', `${report.id}.${fileExt}`);
      await this.storage.upload(key, fileBuffer, contentType);
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

  private async renderReportPdf(reportType: string, payload: any, reportId: string): Promise<Buffer> {
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');

    if (!baseUrl) {
      throw new Error('PYTHON_SERVICE_URL is not configured for PDF report generation');
    }

    const response = await axios.post(
      `${baseUrl}/reports/render-pdf`,
      { report_type: reportType, payload, report_id: reportId },
      {
        headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined,
        responseType: 'arraybuffer',
        timeout: 15000,
      },
    );

    const buf = Buffer.from(response.data);
    if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF-')) {
      throw new Error(`Renderer returned non-PDF content for report ${reportId}`);
    }
    return buf;
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

      // Intervention lineage: links weak-topic detection → auto-assignment → outcome
      const interventions = await this.prisma.intervention.findMany({
        where: { studentProfileId: scope.studentId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { topic: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });

      // Auto-generated assignments linked to this student
      const assignments = await this.prisma.assignment.findMany({
        where: {
          studentProfileId: scope.studentId,
          isAutoGenerated: true,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: { topic: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });

      // Mistake-type aggregation across both v1 (AnswerSheet) and v2 (Attempt)
      const responses = await this.prisma.response.findMany({
        where: {
          OR: [
            { answerSheet: { studentProfileId: scope.studentId } },
            { attempt: { studentProfileId: scope.studentId } },
          ],
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: {
          question: { select: { topic: { select: { name: true } } } },
          evaluation: { include: { currentVersion: true } },
        },
      });

      const mistakeCounts: Record<string, number> = {};
      const marksLostByTag: Record<string, number> = {};
      const byTopic: Record<string, { count: number; marksLost: number }> = {};

      for (const r of responses) {
        // Enforce AI governance: only authoritative (human teacher/reviewer or capture-time objective)
        const currentVersion = r.evaluation?.currentVersion;
        const isAuthoritative = r.evaluation
          ? currentVersion && (currentVersion.source === 'TEACHER' || currentVersion.source === 'REVIEWER')
          : true;

        if (!isAuthoritative) continue;

        const awarded = currentVersion ? currentVersion.marksAwarded : r.marksAwarded;
        const available = r.marksAvailable;
        const lost = Math.max(0, available - awarded);
        const topicName = r.question?.topic?.name ?? 'General';

        // Extract tags from v1 (mistakeTags array) or v2 (mistakeTagType)
        const tags: string[] = [];
        if (r.mistakeTags && r.mistakeTags.length > 0) {
          tags.push(...r.mistakeTags);
        } else if (currentVersion?.mistakeTagType) {
          tags.push(currentVersion.mistakeTagType);
        } else if (lost > 0) {
          tags.push('UNTAGGED');
        }

        for (const tag of tags) {
          mistakeCounts[tag] = (mistakeCounts[tag] || 0) + 1;
          marksLostByTag[tag] = Math.round(((marksLostByTag[tag] || 0) + lost) * 100) / 100;

          if (!byTopic[topicName]) {
            byTopic[topicName] = { count: 0, marksLost: 0 };
          }
          byTopic[topicName]!.count += 1;
          byTopic[topicName]!.marksLost = Math.round((byTopic[topicName]!.marksLost + lost) * 100) / 100;
        }
      }

      const totalMistakes = Object.values(mistakeCounts).reduce((a, b) => a + b, 0);
      const mistakeSummary = totalMistakes > 0
        ? {
            ...mistakeCounts,
            byTag: mistakeCounts,
            marksLostByTag,
            byTopic,
            totalMistakes,
          }
        : undefined;

      return {
        type, scope,
        student: { name: student.user.name, rollNumber: student.rollNumber },
        scores: scores
          .filter((s) => s.exam !== null)
          .map((s) => ({ exam: s.exam!.title, examType: s.exam!.type, percentage: s.percentage, obtainedMarks: s.obtainedMarks, totalMarks: s.totalMarks, createdAt: s.createdAt.toISOString() })),
        mastery: mastery.map((m) => ({ subject: m.subject.name, topic: m.topic.name, masteryValue: m.masteryValue, trend: m.trend })),
        interventions: interventions.map((i) => ({
          topic: i.topic.name,
          beforeMastery: i.beforeMastery,
          afterMastery: i.afterMastery,
          type: i.type,
          createdAt: i.createdAt.toISOString(),
        })),
        assignments: assignments.map((a) => ({
          topic: a.topic.name,
          title: a.title,
          status: a.status,
          submittedAt: a.submittedAt?.toISOString() ?? null,
          gradedMarks: a.gradedMarks,
          dueDate: a.dueDate.toISOString(),
        })),
        mistakeSummary,
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
          interventions: { where: dateFilter ? { createdAt: dateFilter } : undefined },
          assignments: { where: dateFilter ? { createdAt: dateFilter } : undefined },
        },
      });

      let totalExams = 0;
      let totalInterventions = 0;
      let totalImprovedInterventions = 0;
      let totalAssignments = 0;
      let totalCompletedAssignments = 0;
      const validAverages: number[] = [];

      const roster = students.map((s) => {
        const avg = s.scoreRecords.length
          ? s.scoreRecords.reduce((sum, r) => sum + r.percentage, 0) / s.scoreRecords.length
          : null;
        if (avg !== null) validAverages.push(avg);

        const sInterventions = s.interventions.length;
        const sImproved = s.interventions.filter(
          (i) => i.afterMastery != null && i.beforeMastery != null && i.afterMastery > i.beforeMastery,
        ).length;
        const sAssignments = s.assignments.length;
        const sCompleted = s.assignments.filter(
          (a) => a.status === 'SUBMITTED' || a.status === 'GRADED',
        ).length;

        totalExams += s.scoreRecords.length;
        totalInterventions += sInterventions;
        totalImprovedInterventions += sImproved;
        totalAssignments += sAssignments;
        totalCompletedAssignments += sCompleted;

        return {
          name: s.user.name,
          rollNumber: s.rollNumber,
          averagePercentage: avg,
          examCount: s.scoreRecords.length,
          interventionsCount: sInterventions,
          improvedCount: sImproved,
          assignmentsCount: sAssignments,
          completedAssignmentsCount: sCompleted,
        };
      });

      const cohortAverage = validAverages.length
        ? Math.round(validAverages.reduce((sum, a) => sum + a, 0) / validAverages.length)
        : null;
      const interventionSuccessRate = totalInterventions > 0
        ? Math.round((totalImprovedInterventions / totalInterventions) * 100)
        : null;
      const assignmentCompletionRate = totalAssignments > 0
        ? Math.round((totalCompletedAssignments / totalAssignments) * 100)
        : null;

      return {
        type,
        scope,
        batch: {
          name: batch.name,
          classYear: batch.classYear,
          cohortAverage,
          interventionSuccessRate,
          assignmentCompletionRate,
          totalExams,
          totalInterventions,
          totalAssignments,
          roster,
        },
        roster,
        ...(roster.every((r) => r.examCount === 0) ? { note: 'no data in range' } : {}),
      };
    }

    if (scope.teacherId) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { id: scope.teacherId },
        include: {
          user: { select: { name: true, email: true, instituteId: true } },
          batchAssignments: {
            where: { removedAt: null },
            include: {
              batch: { select: { id: true, name: true, classYear: true } },
            },
          },
        },
      });
      if (!teacher || teacher.user.instituteId !== instituteId) {
        return { type, scope, note: 'no data in range', reason: 'teacher_not_found' };
      }

      const subjects = teacher.subjectIds?.length
        ? await this.prisma.subject.findMany({
            where: { id: { in: teacher.subjectIds } },
            select: { id: true, name: true },
          })
        : [];
      const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

      const assignedBatches = teacher.batchAssignments.map((ba) => ({
        batchName: ba.batch.name,
        classYear: ba.batch.classYear,
        subjectName: ba.subjectId ? (subjectMap.get(ba.subjectId) ?? 'General') : 'General',
      }));

      return {
        type,
        scope,
        teacher: {
          name: teacher.user.name,
          email: teacher.user.email,
          qualification: teacher.qualification,
          assignedBatches,
        },
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

export function csvEscape(value: unknown): string {
  if (value == null) return '';
  let str = String(value);

  // OWASP CSV / Spreadsheet Formula Injection defense (CWE-1236):
  // If a string begins with =, +, -, @, or tab/return, and is not a pure numeric literal,
  // prefix with a single quote ' so spreadsheet engines parse it strictly as text.
  if (/^[=+\-@\t\r]/.test(str)) {
    const isPureNumber = !isNaN(Number(str)) && !isNaN(parseFloat(str));
    if (!isPureNumber) {
      str = `'${str}`;
    }
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function renderReportCsv(type: string, payload: any): string {
  const title = type.replace(/_/g, ' ');
  const lines: string[] = [];

  lines.push(`Report Type,${csvEscape(title)}`);
  lines.push(`Generated At,${csvEscape(new Date().toISOString())}`);
  lines.push('');

  if (payload.student) {
    lines.push(`Student Name,${csvEscape(payload.student.name)}`);
    lines.push(`Roll Number,${csvEscape(payload.student.rollNumber ?? '—')}`);
    lines.push('');

    lines.push('--- EXAM SCORES ---');
    lines.push('Exam,Type,Marks Obtained,Total Marks,Percentage');
    for (const s of payload.scores ?? []) {
      lines.push(`${csvEscape(s.exam)},${csvEscape(s.examType)},${s.obtainedMarks},${s.totalMarks},${s.percentage}%`);
    }
    lines.push('');

    lines.push('--- TOPIC MASTERY ---');
    lines.push('Subject,Topic,Mastery Percentage,Trend');
    for (const m of payload.mastery ?? []) {
      const trend = m.trend > 0 ? 'Improving' : m.trend < 0 ? 'Declining' : 'Stable';
      lines.push(`${csvEscape(m.subject)},${csvEscape(m.topic)},${Math.round(m.masteryValue * 100)}%,${trend}`);
    }
    lines.push('');

    lines.push('--- INTERVENTIONS ---');
    lines.push('Topic,Before Mastery,After Mastery,Delta,Type,Date');
    for (const i of payload.interventions ?? []) {
      const before = i.beforeMastery != null ? `${Math.round(i.beforeMastery * 100)}%` : '—';
      const after = i.afterMastery != null ? `${Math.round(i.afterMastery * 100)}%` : '—';
      const delta = i.beforeMastery != null && i.afterMastery != null ? `${Math.round((i.afterMastery - i.beforeMastery) * 100)}%` : '—';
      lines.push(`${csvEscape(i.topic)},${before},${after},${delta},${csvEscape(i.type)},${csvEscape(i.createdAt)}`);
    }
  } else if (payload.batch) {
    lines.push(`Batch Name,${csvEscape(payload.batch.name)}`);
    lines.push(`Cohort Size,${payload.batch.cohortSize}`);
    lines.push(`Class Average,${payload.batch.cohortAverage != null ? `${payload.batch.cohortAverage}%` : '—'}`);
    lines.push(`Intervention Success Rate,${payload.batch.interventionSuccessRate != null ? `${payload.batch.interventionSuccessRate}%` : '—'}`);
    lines.push(`Assignment Completion Rate,${payload.batch.assignmentCompletionRate != null ? `${payload.batch.assignmentCompletionRate}%` : '—'}`);
    lines.push('');

    lines.push('--- STUDENT ROSTER ---');
    lines.push('Student Name,Roll Number,Average Percentage,Exams Taken,Interventions Improved,Interventions Total,Assignments Completed,Assignments Total');
    for (const r of payload.roster ?? []) {
      lines.push(`${csvEscape(r.name)},${csvEscape(r.rollNumber ?? '—')},${r.averagePercentage != null ? `${Math.round(r.averagePercentage)}%` : '—'},${r.examCount},${r.improvedCount ?? 0},${r.interventionsCount ?? 0},${r.completedAssignmentsCount ?? 0},${r.assignmentsCount ?? 0}`);
    }
  } else if (payload.teacher) {
    lines.push(`Teacher Name,${csvEscape(payload.teacher.name)}`);
    lines.push(`Email,${csvEscape(payload.teacher.email)}`);
    lines.push(`Qualification,${csvEscape(payload.teacher.qualification ?? '—')}`);
    lines.push('');

    lines.push('--- ASSIGNED BATCHES ---');
    lines.push('Batch Name,Class Year,Subject');
    for (const b of payload.teacher.assignedBatches ?? []) {
      lines.push(`${csvEscape(b.batchName)},${csvEscape(b.classYear ?? '—')},${csvEscape(b.subjectName)}`);
    }
  } else {
    lines.push(`Status,${csvEscape(payload.note ?? 'No data in range')}`);
  }

  return lines.join('\n');
}

const REPORT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 32px 24px;
    background: #f8fafc;
    -webkit-font-smoothing: antialiased;
  }
  .sheet {
    max-width: 860px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 40px 48px;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  }
  .header-band {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 20px;
    margin-bottom: 24px;
  }
  .brand-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4f46e5;
  }
  .report-title {
    font-size: 24px;
    font-weight: 800;
    color: #0f172a;
    margin: 4px 0;
    letter-spacing: -0.02em;
  }
  .report-subtitle {
    font-size: 13.5px;
    color: #475569;
    font-weight: 500;
  }
  .meta-box {
    text-align: right;
    font-size: 11.5px;
    color: #64748b;
  }
  .meta-box strong { color: #1e293b; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
    margin: 20px 0 28px;
  }
  .kpi-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .kpi-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }
  .kpi-val {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    margin-top: 4px;
  }
  h3 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #334155;
    margin: 28px 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 12.5px;
  }
  th {
    text-align: left;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-bottom: 1px solid #cbd5e1;
    padding: 9px 12px;
  }
  td {
    padding: 9px 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #1e293b;
  }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafbfc; }
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 9999px;
    font-size: 10.5px;
    font-weight: 700;
  }
  .badge-success { background: #ecfdf5; color: #047857; }
  .badge-warning { background: #fffbeb; color: #b45309; }
  .badge-danger { background: #fff1f2; color: #be123c; }
  .note {
    margin-top: 20px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #64748b;
    font-size: 12.5px;
  }
  .sign-off-section {
    display: flex;
    justify-content: space-between;
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px dashed #cbd5e1;
  }
  .sign-box {
    text-align: center;
    width: 180px;
  }
  .sign-line {
    border-top: 1px solid #64748b;
    margin-bottom: 6px;
  }
  .sign-label {
    font-size: 11px;
    font-weight: 600;
    color: #475569;
  }
  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    color: #94a3b8;
    font-size: 10.5px;
  }
  .btn-print {
    background: #4f46e5;
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .btn-print:hover { background: #4338ca; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; box-shadow: none; padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
`;

export function renderReportHtml(type: string, payload: any, reportId?: string): string {
  const title = type.replace(/_/g, ' ');
  const generatedAt = new Date().toLocaleString();
  const refCode = reportId ? reportId.slice(-8).toUpperCase() : 'AIOS-REC';

  let body: string;
  if (payload.student) {
    body = `
      <h3>Official Examination Scores</h3>
      ${payload.scores?.length ? `
        <table>
          <thead><tr><th>Exam Title</th><th>Type</th><th>Score Obtained</th><th>Percentage</th></tr></thead>
          <tbody>${payload.scores.map((s: any) => `
            <tr>
              <td><strong>${escapeHtml(s.exam)}</strong></td>
              <td>${escapeHtml(s.examType)}</td>
              <td>${escapeHtml(s.obtainedMarks)} / ${escapeHtml(s.totalMarks)}</td>
              <td><strong>${fmtPct(s.percentage)}</strong></td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<p class="note">No examination records recorded in this evaluation window.</p>'}

      <h3>Topic-Level Academic Mastery</h3>
      ${payload.mastery?.length ? `
        <table>
          <thead><tr><th>Subject</th><th>Topic</th><th>Mastery %</th><th>Trajectory</th></tr></thead>
          <tbody>${payload.mastery.map((m: any) => `
            <tr>
              <td>${escapeHtml(m.subject)}</td>
              <td>${escapeHtml(m.topic)}</td>
              <td><strong>${fmtPct(m.masteryValue * 100)}</strong></td>
              <td>${m.trend > 0 ? '<span class="badge badge-success">↑ Improving</span>' : m.trend < 0 ? '<span class="badge badge-danger">↓ Declining</span>' : '<span class="badge badge-warning">→ Stable</span>'}</td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<p class="note">Mastery metrics will populate as assessments are scored.</p>'}

      <h3>Targeted Interventions & Gap Resolution</h3>
      ${payload.interventions?.length ? `
        <table>
          <thead><tr><th>Topic</th><th>Initial Mastery</th><th>Final Mastery</th><th>Growth</th><th>Remediation Type</th><th>Date</th></tr></thead>
          <tbody>${payload.interventions.map((i: any) => {
            const before = i.beforeMastery != null ? Math.round(i.beforeMastery * 100) : null;
            const after = i.afterMastery != null ? Math.round(i.afterMastery * 100) : null;
            const delta = before != null && after != null ? after - before : null;
            const deltaStr = delta != null ? (delta >= 0 ? `+${delta}%` : `${delta}%`) : '—';
            return `<tr>
              <td><strong>${escapeHtml(i.topic)}</strong></td>
              <td>${fmtPct(before)}</td>
              <td>${fmtPct(after)}</td>
              <td><span class="badge ${delta && delta >= 0 ? 'badge-success' : 'badge-danger'}">${escapeHtml(deltaStr)}</span></td>
              <td>${escapeHtml(i.type)}</td>
              <td>${escapeHtml(new Date(i.createdAt).toLocaleDateString())}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<p class="note">No targeted intervention sessions recorded in this period.</p>'}

      <h3>Assigned Practice & Homework Completion</h3>
      ${payload.assignments?.length ? `
        <table>
          <thead><tr><th>Topic</th><th>Assignment Title</th><th>Status</th><th>Submitted</th><th>Marks</th><th>Due Date</th></tr></thead>
          <tbody>${payload.assignments.map((a: any) => `
            <tr>
              <td>${escapeHtml(a.topic)}</td>
              <td><strong>${escapeHtml(a.title)}</strong></td>
              <td><span class="badge ${a.status === 'GRADED' || a.status === 'SUBMITTED' ? 'badge-success' : 'badge-warning'}">${escapeHtml(a.status)}</span></td>
              <td>${a.submittedAt ? escapeHtml(new Date(a.submittedAt).toLocaleDateString()) : '—'}</td>
              <td>${a.gradedMarks != null ? escapeHtml(a.gradedMarks) : '—'}</td>
              <td>${escapeHtml(new Date(a.dueDate).toLocaleDateString())}</td>
            </tr>
          `).join('')}</tbody>
        </table>` : '<p class="note">No practice assignments assigned in this period.</p>'}

      ${payload.mistakeSummary ? `
        <h3>Cognitive Mistake Pattern Summary</h3>
        <table>
          <thead><tr><th>Observed Pattern Type</th><th>Evaluation Frequency</th></tr></thead>
          <tbody>${Object.entries(payload.mistakeSummary).map(([tag, count]) => `
            <tr><td><strong>${escapeHtml(tag.replace(/_/g, ' '))}</strong></td><td>${escapeHtml(count)} occurrences</td></tr>
          `).join('')}</tbody>
        </table>` : ''}
    `;
  } else if (payload.batch) {
    body = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Cohort Size</div>
          <div class="kpi-val">${payload.batch.cohortSize ?? payload.roster.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Class Average</div>
          <div class="kpi-val">${fmtPct(payload.batch.cohortAverage)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Remediations</div>
          <div class="kpi-val">${escapeHtml(payload.batch.totalInterventions ?? 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Remediation Growth</div>
          <div class="kpi-val" style="color: #047857;">${fmtPct(payload.batch.interventionSuccessRate)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Assignment Rate</div>
          <div class="kpi-val" style="color: #4f46e5;">${fmtPct(payload.batch.assignmentCompletionRate)}</div>
        </div>
      </div>

      <h3>Student Roster & Lineage</h3>
      <table>
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Roll Number</th>
            <th>Average %</th>
            <th>Exams</th>
            <th>Remediations (Resolved/Total)</th>
            <th>Assignments (Done/Total)</th>
          </tr>
        </thead>
        <tbody>${payload.roster.map((r: any) => `
          <tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${escapeHtml(r.rollNumber ?? '—')}</td>
            <td><strong>${fmtPct(r.averagePercentage)}</strong></td>
            <td>${escapeHtml(r.examCount)}</td>
            <td>${escapeHtml(r.improvedCount ?? 0)} / ${escapeHtml(r.interventionsCount ?? 0)}</td>
            <td>${escapeHtml(r.completedAssignmentsCount ?? 0)} / ${escapeHtml(r.assignmentsCount ?? 0)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
      ${payload.note ? `<p class="note">${escapeHtml(payload.note)}</p>` : ''}
    `;
  } else if (payload.teacher) {
    body = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Qualification</div>
          <div class="kpi-val" style="font-size: 16px;">${escapeHtml(payload.teacher.qualification ?? '—')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Assigned Batches</div>
          <div class="kpi-val">${payload.teacher.assignedBatches?.length ?? 0}</div>
        </div>
      </div>

      <h3>Assigned Teaching Batches & Curricula</h3>
      <table>
        <thead><tr><th>Batch Name</th><th>Academic Class Year</th><th>Subject</th></tr></thead>
        <tbody>${(payload.teacher.assignedBatches ?? []).map((b: any) => `
          <tr>
            <td><strong>${escapeHtml(b.batchName)}</strong></td>
            <td>${escapeHtml(b.classYear ?? '—')}</td>
            <td>${escapeHtml(b.subjectName)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  } else {
    body = `<p class="note">${escapeHtml(payload.note ?? 'No records available for the requested scope.')}</p>`;
  }

  const subjectHeadline = payload.student
    ? `${escapeHtml(payload.student.name)} ${payload.student.rollNumber ? `· Roll No. ${escapeHtml(payload.student.rollNumber)}` : ''}`
    : payload.batch
    ? `Batch: ${escapeHtml(payload.batch.name)}`
    : payload.teacher
    ? `Faculty: ${escapeHtml(payload.teacher.name)}`
    : 'Institutional Scope';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — ${escapeHtml(subjectHeadline)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="sheet">
    <div class="header-band">
      <div>
        <div class="brand-title">AIOS Academic Intelligence</div>
        <h1 class="report-title">${escapeHtml(title)}</h1>
        <div class="report-subtitle">${subjectHeadline}</div>
      </div>
      <div class="meta-box">
        <div>Ref: <strong>#${escapeHtml(refCode)}</strong></div>
        <div>Date: <strong>${escapeHtml(generatedAt)}</strong></div>
        <div style="margin-top: 8px;" class="no-print">
          <button onclick="window.print()" class="btn-print">Print / Save as PDF</button>
        </div>
      </div>
    </div>

    ${body}

    <div class="sign-off-section">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Principal / Academic Director</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Academic Coordinator</div>
      </div>
    </div>

    <div class="footer">
      <span>AIOS Academic Intelligence — Certified Institutional Document</span>
      <span>Verification Key: ${escapeHtml(refCode)}</span>
    </div>
  </div>
</body>
</html>`;
}
