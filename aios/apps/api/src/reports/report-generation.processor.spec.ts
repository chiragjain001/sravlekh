import ExcelJS from 'exceljs';
import { csvEscape, renderReportCsv, renderReportHtml } from './report-generation.processor';
import { renderReportExcel } from './report-excel.renderer';

describe('ReportGenerationProcessor Artifact Formatting & Security', () => {
  describe('renderReportExcel — Genuine Multi-Sheet Workbook (.xlsx)', () => {
    it('generates a valid, readable .xlsx binary file with student transcript sheets & formulas', async () => {
      const payload = {
        student: { name: 'Alice Smith', rollNumber: '101' },
        scores: [
          { exam: 'Physics Midterm', examType: 'MIDTERM', obtainedMarks: 85, totalMarks: 100, percentage: 85 },
          { exam: 'Chemistry Midterm', examType: 'MIDTERM', obtainedMarks: 90, totalMarks: 100, percentage: 90 },
        ],
        mastery: [
          { subject: 'Physics', topic: 'Kinematics', masteryValue: 0.85, trend: 1 },
          { subject: 'Chemistry', topic: 'Thermodynamics', masteryValue: 0.45, trend: -1 },
        ],
        interventions: [
          { topic: 'Thermodynamics', beforeMastery: 0.45, afterMastery: 0.70, type: 'DOUBT_SESSION', createdAt: '2026-10-01' },
        ],
      };

      const buffer = await renderReportExcel('REPORT_CARD', payload, 'rep-excel-01');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      // Verify OpenXML / ZIP signature (PK\x03\x04 = 0x50, 0x4b, 0x03, 0x04)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
      expect(buffer[2]).toBe(0x03);
      expect(buffer[3]).toBe(0x04);

      // Load into ExcelJS to verify multi-sheet structure and formula contents
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      expect(wb.worksheets.map((w) => w.name)).toEqual([
        'Academic Scores',
        'Topic Mastery',
        'Interventions & Remediation',
      ]);

      const sheet1 = wb.getWorksheet('Academic Scores');
      expect(sheet1).toBeDefined();
      expect(sheet1?.getCell('A1').value).toContain('AIOS ACADEMIC INTELLIGENCE');
      expect(sheet1?.getCell('A2').value).toContain('Alice Smith');
      // Verify formula row was injected
      expect(sheet1?.getCell('C9').value).toEqual({ formula: 'AVERAGE(C7:C8)' });

      const sheet2 = wb.getWorksheet('Topic Mastery');
      expect(sheet2?.getCell('B2').value).toBe('Kinematics');
      expect(sheet2?.getCell('D2').value).toBe('HEALTHY');
      expect(sheet2?.getCell('D3').value).toBe('CRITICAL');
    });

    it('generates a valid .xlsx workbook with student roster and AutoFilter for batch reports', async () => {
      const payload = {
        batch: {
          name: 'Batch 11-A',
          classYear: 'Class 11',
          cohortAverage: 78,
          interventionSuccessRate: 85,
          assignmentCompletionRate: 92,
          totalExams: 15,
        },
        roster: [
          {
            name: 'Bob Jones',
            rollNumber: '102',
            averagePercentage: 81,
            examCount: 4,
            improvedCount: 2,
            interventionsCount: 2,
            completedAssignmentsCount: 10,
            assignmentsCount: 10,
          },
        ],
      };

      const buffer = await renderReportExcel('CLASS_REPORT', payload, 'rep-excel-02');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      expect(wb.worksheets.map((w) => w.name)).toEqual([
        'Cohort Overview',
        'Student Performance Roster',
      ]);

      const rosterSheet = wb.getWorksheet('Student Performance Roster');
      expect(rosterSheet?.autoFilter).toBeDefined();
      expect(rosterSheet?.getCell('B2').value).toBe('Bob Jones');
    });
  });

  describe('csvEscape & Formula Injection Defense (CWE-1236)', () => {
    it('sanitizes strings starting with formula triggers = + - @ \\t', () => {
      expect(csvEscape('=cmd|/C calc!A0')).toBe("'=cmd|/C calc!A0");
      expect(csvEscape('+12345Attack')).toBe("'+12345Attack");
      expect(csvEscape('@SUM(A1:B10)')).toBe("'@SUM(A1:B10)");
      expect(csvEscape('@SUM(1,2)')).toBe("\"'@SUM(1,2)\"");
      expect(csvEscape('\tmaliciousTab')).toBe("'\tmaliciousTab");
    });

    it('preserves legitimate pure numbers including negative values', () => {
      expect(csvEscape(-15)).toBe('-15');
      expect(csvEscape('-25.5')).toBe('-25.5');
      expect(csvEscape('+42')).toBe('+42');
      expect(csvEscape(100)).toBe('100');
    });

    it('correctly escapes commas, quotes, and newlines per RFC 4180', () => {
      expect(csvEscape('Doe, John')).toBe('"Doe, John"');
      expect(csvEscape('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(csvEscape("Line 1\nLine 2")).toBe("\"Line 1\nLine 2\"");
    });
  });

  describe('renderReportCsv', () => {
    it('produces valid CSV structure for student report card', () => {
      const payload = {
        student: { name: 'Alice Smith', rollNumber: '101' },
        scores: [
          { exam: 'Physics Midterm', examType: 'MIDTERM', obtainedMarks: 85, totalMarks: 100, percentage: 85 },
        ],
        mastery: [
          { subject: 'Physics', topic: 'Kinematics', masteryValue: 0.82, trend: 1 },
        ],
        interventions: [
          { topic: 'Optics', beforeMastery: 0.45, afterMastery: 0.70, type: 'DOUBT_SESSION', createdAt: '2026-10-01' },
        ],
      };

      const csv = renderReportCsv('REPORT_CARD', payload);

      expect(csv).toContain('Report Type,REPORT CARD');
      expect(csv).toContain('Student Name,Alice Smith');
      expect(csv).toContain('--- EXAM SCORES ---');
      expect(csv).toContain('Physics Midterm,MIDTERM,85,100,85%');
      expect(csv).toContain('--- TOPIC MASTERY ---');
      expect(csv).toContain('Physics,Kinematics,82%,Improving');
      expect(csv).toContain('--- INTERVENTIONS ---');
      expect(csv).toContain('Optics,45%,70%,25%,DOUBT_SESSION,2026-10-01');
    });

    it('produces valid CSV structure for batch summary report', () => {
      const payload = {
        batch: {
          name: 'Batch 11-A',
          cohortSize: 30,
          cohortAverage: 78,
          interventionSuccessRate: 85,
          assignmentCompletionRate: 92,
        },
        roster: [
          {
            name: 'Bob Jones',
            rollNumber: '102',
            averagePercentage: 81,
            examCount: 4,
            improvedCount: 2,
            interventionsCount: 2,
            completedAssignmentsCount: 10,
            assignmentsCount: 10,
          },
        ],
      };

      const csv = renderReportCsv('CLASS_REPORT', payload);

      expect(csv).toContain('Batch Name,Batch 11-A');
      expect(csv).toContain('Class Average,78%');
      expect(csv).toContain('--- STUDENT ROSTER ---');
      expect(csv).toContain('Bob Jones,102,81%,4,2,2,10,10');
    });
  });

  describe('renderReportHtml', () => {
    it('renders official institutional stationery with print styles and verification key', () => {
      const payload = {
        student: { name: 'Alice Smith', rollNumber: '101' },
        scores: [
          { exam: 'Chemistry Final', examType: 'TERM', obtainedMarks: 90, totalMarks: 100, percentage: 90 },
        ],
        mastery: [],
        interventions: [],
      };

      const html = renderReportHtml('REPORT_CARD', payload, 'rep-xyz123');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('AIOS Academic Intelligence');
      expect(html).toContain('REPORT CARD');
      expect(html).toContain('Alice Smith');
      expect(html).toContain('@media print');
      expect(html).toContain('Print / Save as PDF');
      expect(html).toContain('Verification Key:');
      expect(html).toContain('P-XYZ123');
    });

    it('escapes HTML special characters to prevent injection in document view', () => {
      const payload = {
        student: { name: '<script>alert("xss")</script>', rollNumber: '999' },
        scores: [],
        mastery: [],
        interventions: [],
      };

      const html = renderReportHtml('REPORT_CARD', payload, 'rep-safe');

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });
});
