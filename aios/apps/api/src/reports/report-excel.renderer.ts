import ExcelJS from 'exceljs';

interface CellBorder {
  top?: { style: ExcelJS.BorderStyle; color: { argb: string } };
  bottom?: { style: ExcelJS.BorderStyle; color: { argb: string } };
  left?: { style: ExcelJS.BorderStyle; color: { argb: string } };
  right?: { style: ExcelJS.BorderStyle; color: { argb: string } };
}

const THIN_BORDER: CellBorder = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' }, // Slate 800
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Segoe UI',
  size: 10,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const SUMMARY_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF1F5F9' }, // Slate 100
};

/**
 * Generates an official, dynamic, multi-sheet Microsoft Excel (.xlsx) workbook
 * conforming to educational board reporting and institutional administrative standards.
 */
export async function renderReportExcel(
  type: string,
  payload: any,
  reportId: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AIOS Academic Intelligence & Reporting';
  workbook.lastModifiedBy = 'AIOS Institutional Registry';
  workbook.created = new Date();
  workbook.modified = new Date();

  const title = type.replace(/_/g, ' ');

  if (payload.student) {
    buildStudentWorkbook(workbook, title, payload, reportId);
  } else if (payload.batch) {
    buildBatchWorkbook(workbook, title, payload, reportId);
  } else if (payload.teacher) {
    buildTeacherWorkbook(workbook, title, payload, reportId);
  } else {
    buildFallbackWorkbook(workbook, title, payload, reportId);
  }

  // Adjust column widths across all sheets
  for (const sheet of workbook.worksheets) {
    sheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const val = cell.value ? String(cell.value) : '';
        if (val.length > maxLen && val.length < 50) {
          maxLen = val.length;
        }
      });
      column.width = Math.min(Math.max(maxLen + 4, 14), 45);
    });
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
}

// ── Student Report Cards & Transcripts ──────────────────────────────────────

function buildStudentWorkbook(workbook: ExcelJS.Workbook, title: string, payload: any, reportId: string) {
  const { student, scores = [], mastery = [], interventions = [] } = payload;

  // Sheet 1: Academic Scores & Transcript
  const ws1 = workbook.addWorksheet('Academic Scores');
  ws1.views = [{ state: 'frozen', ySplit: 6 }];

  // Banner Header
  ws1.mergeCells('A1:E1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = `AIOS ACADEMIC INTELLIGENCE — ${title.toUpperCase()}`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E293B' } };

  ws1.mergeCells('A2:E2');
  const subCell = ws1.getCell('A2');
  subCell.value = `Student: ${student.name} | Roll No: ${student.rollNumber ?? '—'} | Verification Key: #${reportId.slice(-8).toUpperCase()}`;
  subCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF64748B' } };

  ws1.mergeCells('A3:E3');
  ws1.getCell('A3').value = `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Status: Certified Institutional Record`;
  ws1.getCell('A3').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };

  // KPI Tiles row
  ws1.addRow([]);
  const validScores = scores.filter((s: any) => s.percentage != null);
  const avgPct = validScores.length
    ? Math.round(validScores.reduce((sum: number, s: any) => sum + s.percentage, 0) / validScores.length)
    : null;

  const kpiRow = ws1.addRow([
    `Exams Taken: ${scores.length}`,
    `Average Score: ${avgPct != null ? `${avgPct}%` : '—'}`,
    `Mastery Topics: ${mastery.length}`,
    `Remedial Sessions: ${interventions.length}`,
    '',
  ]);
  kpiRow.eachCell((c) => {
    c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4F46E5' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    c.border = THIN_BORDER;
  });

  // Table Headers
  const headerRow = ws1.addRow(['Exam Title', 'Assessment Category', 'Marks Awarded', 'Maximum Marks', 'Percentage']);
  headerRow.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Score Rows
  scores.forEach((s: any) => {
    const row = ws1.addRow([
      s.exam,
      s.examType ?? 'General',
      s.obtainedMarks,
      s.totalMarks,
      s.percentage != null ? s.percentage / 100 : null,
    ]);
    row.getCell(3).alignment = { horizontal: 'right' };
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(5).numFmt = '0.0%';
    row.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 10 };
    });
  });

  if (scores.length > 0) {
    const startRow = 7;
    const endRow = 6 + scores.length;
    const totalRow = ws1.addRow([
      'Overall Academic Average',
      'Summary Aggregate',
      { formula: `AVERAGE(C${startRow}:C${endRow})` },
      { formula: `AVERAGE(D${startRow}:D${endRow})` },
      { formula: `AVERAGE(E${startRow}:E${endRow})` },
    ]);
    totalRow.eachCell((c) => {
      c.fill = SUMMARY_FILL;
      c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      c.border = THIN_BORDER;
    });
    totalRow.getCell(3).numFmt = '0.0';
    totalRow.getCell(4).numFmt = '0.0';
    totalRow.getCell(5).numFmt = '0.0%';
  }

  // Sheet 2: Topic Mastery Diagnostics
  const ws2 = workbook.addWorksheet('Topic Mastery');
  ws2.views = [{ state: 'frozen', ySplit: 2 }];
  const mHead = ws2.addRow(['Curriculum Subject', 'Topic Name', 'Mastery Level', 'Academic Health', 'Learning Trajectory']);
  mHead.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
  });

  mastery.forEach((m: any) => {
    const val = m.masteryValue != null ? m.masteryValue : 0;
    const health = val >= 0.7 ? 'HEALTHY' : val >= 0.5 ? 'WARNING' : 'CRITICAL';
    const trend = m.trend > 0 ? 'Improving' : m.trend < 0 ? 'Declining' : 'Stable';
    const row = ws2.addRow([m.subject, m.topic, val, health, trend]);
    row.getCell(3).numFmt = '0.0%';
    row.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 10 };
    });
  });

  // Sheet 3: Targeted Interventions
  const ws3 = workbook.addWorksheet('Interventions & Remediation');
  ws3.views = [{ state: 'frozen', ySplit: 2 }];
  const iHead = ws3.addRow(['Remedial Topic', 'Baseline Mastery', 'Post-Intervention Mastery', 'Mastery Gain', 'Format', 'Session Date']);
  iHead.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
  });

  interventions.forEach((i: any) => {
    const before = i.beforeMastery != null ? i.beforeMastery : null;
    const after = i.afterMastery != null ? i.afterMastery : null;
    const delta = before != null && after != null ? after - before : null;
    const row = ws3.addRow([
      i.topic,
      before,
      after,
      delta,
      i.type ?? 'Extra Class',
      i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '—',
    ]);
    row.getCell(2).numFmt = '0.0%';
    row.getCell(3).numFmt = '0.0%';
    row.getCell(4).numFmt = '+0.0%;-0.0%;0.0%';
    row.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 10 };
    });
  });
}

// ── Batch & Class Cohort Reports ────────────────────────────────────────────

function buildBatchWorkbook(workbook: ExcelJS.Workbook, title: string, payload: any, reportId: string) {
  const { batch, roster = [] } = payload;

  // Sheet 1: Cohort Overview & KPI Metrics
  const ws1 = workbook.addWorksheet('Cohort Overview');

  ws1.mergeCells('A1:D1');
  const t = ws1.getCell('A1');
  t.value = `AIOS ACADEMIC INTELLIGENCE — ${title.toUpperCase()}`;
  t.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E293B' } };

  ws1.mergeCells('A2:D2');
  const sub = ws1.getCell('A2');
  sub.value = `Batch: ${batch.name} | Class Year: ${batch.classYear ?? '—'} | Ref: #${reportId.slice(-8).toUpperCase()}`;
  sub.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF64748B' } };

  ws1.addRow([]);

  // Department Metric Table
  const metricHead = ws1.addRow(['Institutional Indicator', 'Metric Value', 'Standard Benchmark', 'Department Status']);
  metricHead.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
  });

  const metricsData = [
    ['Total Enrolled Students', roster.length, 'Active Roster', 'Verified'],
    ['Class Academic Average', batch.cohortAverage != null ? batch.cohortAverage / 100 : null, '≥ 70.0%', batch.cohortAverage >= 70 ? 'Proficient' : 'Needs Focus'],
    ['Intervention Success Rate', batch.interventionSuccessRate != null ? batch.interventionSuccessRate / 100 : null, '≥ 80.0%', 'Active Remediation'],
    ['Assignment Completion Rate', batch.assignmentCompletionRate != null ? batch.assignmentCompletionRate / 100 : null, '≥ 85.0%', 'Curriculum Tracking'],
    ['Total Evaluated Examinations', batch.totalExams ?? 0, 'Cumulative Assessments', 'Graded'],
  ];

  metricsData.forEach(([ind, val, bench, stat]) => {
    const row = ws1.addRow([ind, val, bench, stat]);
    if (typeof val === 'number' && val <= 1 && ind !== 'Total Enrolled Students' && ind !== 'Total Evaluated Examinations') {
      row.getCell(2).numFmt = '0.0%';
    }
    row.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 10 };
    });
  });

  // Sheet 2: Student Performance Roster
  const ws2 = workbook.addWorksheet('Student Performance Roster');
  ws2.views = [{ state: 'frozen', ySplit: 2 }];

  const rosterHead = ws2.addRow([
    'Roll Number',
    'Student Full Name',
    'Average Marks',
    'Exams Completed',
    'Interventions Improved',
    'Total Interventions',
    'Completed Homework',
    'Total Assigned Homework',
    'Academic Status',
  ]);
  rosterHead.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
  });

  roster.forEach((r: any) => {
    const avg = r.averagePercentage != null ? r.averagePercentage / 100 : null;
    const standing = avg == null ? 'Pending' : avg >= 0.75 ? 'Distinction' : avg >= 0.5 ? 'Good Standing' : 'Remedial Priority';
    const row = ws2.addRow([
      r.rollNumber ?? '—',
      r.name,
      avg,
      r.examCount,
      r.improvedCount ?? 0,
      r.interventionsCount ?? 0,
      r.completedAssignmentsCount ?? 0,
      r.assignmentsCount ?? 0,
      standing,
    ]);
    row.getCell(3).numFmt = '0.0%';
    row.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 10 };
    });
  });

  // Enable AutoFilter on Roster
  ws2.autoFilter = {
    from: 'A2',
    to: 'I2',
  };

  if (roster.length > 0) {
    const startRow = 3;
    const endRow = 2 + roster.length;
    const totRow = ws2.addRow([
      'Cohort Totals / Averages',
      `Count: ${roster.length} students`,
      { formula: `AVERAGE(C${startRow}:C${endRow})` },
      { formula: `SUM(D${startRow}:D${endRow})` },
      { formula: `SUM(E${startRow}:E${endRow})` },
      { formula: `SUM(F${startRow}:F${endRow})` },
      { formula: `SUM(G${startRow}:G${endRow})` },
      { formula: `SUM(H${startRow}:H${endRow})` },
      '—',
    ]);
    totRow.getCell(3).numFmt = '0.0%';
    totRow.eachCell((c) => {
      c.fill = SUMMARY_FILL;
      c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      c.border = THIN_BORDER;
    });
  }
}

// ── Faculty Evaluation Reports ──────────────────────────────────────────────

function buildTeacherWorkbook(workbook: ExcelJS.Workbook, title: string, payload: any, reportId: string) {
  const { teacher } = payload;
  const ws = workbook.addWorksheet('Faculty Allocations');
  ws.views = [{ state: 'frozen', ySplit: 5 }];

  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = `AIOS ACADEMIC INTELLIGENCE — ${title.toUpperCase()}`;
  ws.getCell('A1').font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E293B' } };

  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `Instructor: ${teacher.name} | Email: ${teacher.email} | Qualification: ${teacher.qualification ?? '—'} | Ref: #${reportId.slice(-8).toUpperCase()}`;
  ws.getCell('A2').font = { name: 'Segoe UI', size: 10, color: { argb: 'FF64748B' } };

  ws.addRow([]);
  ws.addRow([`Total Assigned Cohorts: ${teacher.assignedBatches?.length ?? 0}`]).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF4F46E5' } };

  const head = ws.addRow(['Assigned Batch / Cohort', 'Academic Class Year', 'Curriculum Subject', 'Department Allocation']);
  head.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
  });

  (teacher.assignedBatches ?? []).forEach((b: any) => {
    const row = ws.addRow([b.batchName, b.classYear ?? '—', b.subjectName, 'Active Assigned']);
    row.eachCell((c) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Segoe UI', size: 10 };
    });
  });
}

// ── Fallback Workbook ───────────────────────────────────────────────────────

function buildFallbackWorkbook(workbook: ExcelJS.Workbook, title: string, payload: any, reportId: string) {
  const ws = workbook.addWorksheet('Report Information');
  ws.addRow([`AIOS REPORT: ${title}`]).font = { bold: true, size: 14 };
  ws.addRow([`Report ID: ${reportId}`]);
  ws.addRow([`Generated: ${new Date().toISOString()}`]);
  ws.addRow([`Status: ${payload.note ?? 'Completed'}`]);
}
