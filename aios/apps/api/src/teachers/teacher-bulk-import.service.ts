import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole, UserStatus, AuditAction } from '@prisma/client';
import { BulkTeacherRowDto } from './dto/teacher.dto';

export interface ValidatedTeacherRow {
  rowNumber: number;
  isValid: boolean;
  data: {
    name: string;
    email: string;
    qualification?: string;
    subjectName?: string;
    subjectId?: string;
    batchName?: string;
    batchId?: string;
  };
  errors: string[];
}

export interface BulkTeacherValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  hasErrors: boolean;
  rows: ValidatedTeacherRow[];
  templateVerified: boolean;
}

export interface BulkTeacherCommitResult {
  success: boolean;
  enrolledCount: number;
  failedCount: number;
  failedRows: Array<{
    rowNumber: number;
    name: string;
    email: string;
    errors: string[];
  }>;
}

@Injectable()
export class TeacherBulkImportService {
  private readonly logger = new Logger(TeacherBulkImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private getHmacSecret(): string {
    return process.env.JWT_SECRET || 'aios-bulk-import-tamper-secret-key';
  }

  private generateSignature(instituteId: string): string {
    return crypto
      .createHmac('sha256', this.getHmacSecret())
      .update(`${instituteId}:TEACHER_ONBOARDING_V1`)
      .digest('hex');
  }

  private sanitizeString(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = "'" + str;
    }
    return str;
  }

  /**
   * Generates a context-aware, signed Microsoft Excel (.xlsx) template
   * with live Institute Subjects & Batches in native in-cell dropdowns.
   */
  async generateTemplate(
    instituteId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('You cannot download templates for another institute.');
    }

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, name: true },
    });
    if (!institute) {
      throw new BadRequestException('Institute not found.');
    }

    // Fetch active subjects and batches for this institute
    const [subjects, batches] = await Promise.all([
      this.prisma.subject.findMany({
        where: { instituteId },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.batch.findMany({
        where: { instituteId, isActive: true },
        select: { id: true, name: true, section: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIOS Faculty Onboarding Engine';
    workbook.created = new Date();

    // ── Sheet 1: Faculty Onboarding ──────────────────────────────────────────
    const mainSheet = workbook.addWorksheet('Faculty Onboarding', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    mainSheet.columns = [
      { header: 'Full Name *', key: 'name', width: 28 },
      { header: 'Email Address *', key: 'email', width: 32 },
      { header: 'Qualification', key: 'qualification', width: 28 },
      { header: 'Primary Subject *', key: 'subject', width: 26 },
      { header: 'Assigned Batch (Optional)', key: 'batch', width: 28 },
    ];

    // Style Header Row with emerald theme
    const headerRow = mainSheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF065F46' }, // Emerald 800
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF047857' } },
        right: { style: 'thin', color: { argb: 'FF064E3B' } },
      };
    });

    // ── Sheet 2: _LOOKUPS ──────────────────────────────────────────────────
    const lookupSheet = workbook.addWorksheet('_LOOKUPS');
    lookupSheet.state = 'hidden';

    lookupSheet.getCell('A1').value = 'Subject Name';
    lookupSheet.getCell('B1').value = 'Subject ID';
    lookupSheet.getCell('C1').value = 'Batch Name';
    lookupSheet.getCell('D1').value = 'Batch ID';

    const subjectDisplayNames: string[] = [];
    subjects.forEach((s, idx) => {
      const name = s.code ? `${s.name} (${s.code})` : s.name;
      subjectDisplayNames.push(name);
      lookupSheet.getCell(`A${idx + 2}`).value = name;
      lookupSheet.getCell(`B${idx + 2}`).value = s.id;
    });

    if (subjectDisplayNames.length === 0) {
      lookupSheet.getCell('A2').value = 'General Subject';
      subjectDisplayNames.push('General Subject');
    }

    const batchDisplayNames: string[] = [];
    batches.forEach((b, idx) => {
      const name = b.section ? `${b.name} (${b.section})` : b.name;
      batchDisplayNames.push(name);
      lookupSheet.getCell(`C${idx + 2}`).value = name;
      lookupSheet.getCell(`D${idx + 2}`).value = b.id;
    });

    const maxSubjectRow = Math.max(subjectDisplayNames.length + 1, 2);
    const maxBatchRow = Math.max(batchDisplayNames.length + 1, 2);

    // Apply native Excel Data Validation dropdowns to rows 2 to 300
    for (let r = 2; r <= 300; r++) {
      // Primary Subject Dropdown (Col D)
      mainSheet.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`_LOOKUPS!$A$2:$A$${maxSubjectRow}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Subject',
        error: 'Please choose a subject from the dropdown list.',
      };

      // Assigned Batch Dropdown (Col E)
      if (batchDisplayNames.length > 0) {
        mainSheet.getCell(`E${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_LOOKUPS!$C$2:$C$${maxBatchRow}`],
          showErrorMessage: true,
          errorTitle: 'Invalid Batch',
          error: 'Please choose a batch from the dropdown list.',
        };
      }
    }

    // Add 2 Sample Guide Rows
    const sampleSubject = subjectDisplayNames[0] || 'Mathematics';
    const sampleBatch = batchDisplayNames[0] || '';
    const sampleRows = [
      {
        name: 'Dr. Priya Mehta (Sample)',
        email: 'priya.sample@school.edu',
        qualification: 'Ph.D. Physics, IIT Delhi',
        subject: sampleSubject,
        batch: sampleBatch,
      },
      {
        name: 'Rajiv Saxena (Sample)',
        email: 'rajiv.sample@school.edu',
        qualification: 'M.Sc. Mathematics, B.Ed',
        subject: sampleSubject,
        batch: sampleBatch,
      },
    ];

    sampleRows.forEach((s) => {
      const row = mainSheet.addRow(s);
      row.font = { italic: true, color: { argb: 'FF64748B' }, size: 9.5 };
    });

    // ── Sheet 3: _AIOS_SYSTEM_META ──────────────────────────────────────────
    const metaSheet = workbook.addWorksheet('_AIOS_SYSTEM_META');
    metaSheet.state = 'veryHidden';

    const signature = this.generateSignature(instituteId);
    metaSheet.getCell('A1').value = 'INSTITUTE_ID';
    metaSheet.getCell('B1').value = instituteId;
    metaSheet.getCell('A2').value = 'TEMPLATE_TYPE';
    metaSheet.getCell('B2').value = 'TEACHER_ONBOARDING_V1';
    metaSheet.getCell('A3').value = 'TIMESTAMP';
    metaSheet.getCell('B3').value = new Date().toISOString();
    metaSheet.getCell('A4').value = 'SIGNATURE';
    metaSheet.getCell('B4').value = signature;
    metaSheet.getCell('A5').value = 'VERSION';
    metaSheet.getCell('B5').value = '1.0';

    const safeInstituteName = institute.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `AIOS_Faculty_Onboarding_${safeInstituteName}_${dateStr}.xlsx`;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filename };
  }

  /**
   * Validates an uploaded Teacher Excel workbook against institute records.
   */
  async validateUpload(
    instituteId: string,
    fileBuffer: Buffer,
    actor: AuthenticatedUser,
  ): Promise<BulkTeacherValidationResult> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Access denied for this institute.');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch {
      throw new BadRequestException(
        'Invalid file format. Please upload a valid Microsoft Excel (.xlsx) file.',
      );
    }

    let templateVerified = false;
    const metaSheet = workbook.getWorksheet('_AIOS_SYSTEM_META');
    if (metaSheet) {
      const fileInstituteId = String(metaSheet.getCell('B1').value || '').trim();
      const fileSignature = String(metaSheet.getCell('B4').value || '').trim();
      const expectedSignature = this.generateSignature(instituteId);

      if (fileInstituteId && fileInstituteId !== instituteId) {
        throw new BadRequestException(
          'This template belongs to a different institute. Please download the template from your institute portal.',
        );
      }

      if (fileSignature === expectedSignature) {
        templateVerified = true;
      }
    }

    const sheet = workbook.getWorksheet('Faculty Onboarding') || workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('The uploaded workbook does not contain any readable sheets.');
    }

    // Load active subjects and batches
    const [subjects, batches] = await Promise.all([
      this.prisma.subject.findMany({
        where: { instituteId },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.batch.findMany({
        where: { instituteId, isActive: true },
        select: { id: true, name: true, section: true },
      }),
    ]);

    const subjectMap = new Map<string, { id: string; name: string }>();
    subjects.forEach((s) => {
      const norm = s.name.trim().toLowerCase();
      subjectMap.set(norm, { id: s.id, name: s.name });
      if (s.code) subjectMap.set(`${norm} (${s.code.toLowerCase()})`, { id: s.id, name: s.name });
      subjectMap.set(s.id, { id: s.id, name: s.name });
    });

    const batchMap = new Map<string, { id: string; name: string }>();
    batches.forEach((b) => {
      const norm = b.name.trim().toLowerCase();
      batchMap.set(norm, { id: b.id, name: b.name });
      if (b.section) batchMap.set(`${norm} (${b.section.toLowerCase()})`, { id: b.id, name: b.name });
      batchMap.set(b.id, { id: b.id, name: b.name });
    });

    // Check existing users in this institute
    const existingUsers = await this.prisma.user.findMany({
      where: { instituteId },
      select: { email: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const seenEmailsInFile = new Set<string>();
    const validatedRows: ValidatedTeacherRow[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rawName = this.sanitizeString(row.getCell(1).text || row.getCell(1).value);
      const rawEmail = this.sanitizeString(row.getCell(2).text || row.getCell(2).value);
      const rawQual = this.sanitizeString(row.getCell(3).text || row.getCell(3).value);
      const rawSubject = this.sanitizeString(row.getCell(4).text || row.getCell(4).value);
      const rawBatch = this.sanitizeString(row.getCell(5).text || row.getCell(5).value);

      if (!rawName && !rawEmail && !rawSubject) return;
      if (rawName.includes('(Sample)') || rawEmail.includes('.sample@')) return;

      const errors: string[] = [];

      // Validate Name
      if (!rawName || rawName.length < 2) {
        errors.push('Full Name is required (minimum 2 characters).');
      }

      // Validate Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const lowerEmail = rawEmail.toLowerCase();
      if (!rawEmail) {
        errors.push('Email address is required.');
      } else if (!emailRegex.test(lowerEmail)) {
        errors.push(`Invalid email format: '${rawEmail}'.`);
      } else if (seenEmailsInFile.has(lowerEmail)) {
        errors.push(`Duplicate email within this file: '${rawEmail}'.`);
      } else if (existingEmails.has(lowerEmail)) {
        errors.push(`Email already registered in this institute: '${rawEmail}'.`);
      } else {
        seenEmailsInFile.add(lowerEmail);
      }

      // Validate Subject
      let resolvedSubjectId: string | undefined;
      let resolvedSubjectName: string | undefined;
      if (!rawSubject) {
        errors.push('Primary Subject is required.');
      } else {
        const matched = subjectMap.get(rawSubject.trim().toLowerCase());
        if (matched) {
          resolvedSubjectId = matched.id;
          resolvedSubjectName = matched.name;
        } else {
          errors.push(`Subject '${rawSubject}' was not found in this institute.`);
        }
      }

      // Validate Batch (Optional)
      let resolvedBatchId: string | undefined;
      let resolvedBatchName: string | undefined;
      if (rawBatch) {
        const matched = batchMap.get(rawBatch.trim().toLowerCase());
        if (matched) {
          resolvedBatchId = matched.id;
          resolvedBatchName = matched.name;
        } else {
          errors.push(`Batch '${rawBatch}' was not found in this institute.`);
        }
      }

      validatedRows.push({
        rowNumber,
        isValid: errors.length === 0,
        data: {
          name: rawName,
          email: lowerEmail,
          qualification: rawQual || undefined,
          subjectName: resolvedSubjectName || rawSubject,
          subjectId: resolvedSubjectId,
          batchName: resolvedBatchName || rawBatch,
          batchId: resolvedBatchId,
        },
        errors,
      });
    });

    const validCount = validatedRows.filter((r) => r.isValid).length;
    const invalidCount = validatedRows.length - validCount;

    return {
      totalRows: validatedRows.length,
      validCount,
      invalidCount,
      hasErrors: invalidCount > 0,
      rows: validatedRows,
      templateVerified,
    };
  }

  /**
   * Commits an array of validated teacher records, creating Users, TeacherProfiles,
   * BatchTeacher records, and audit logs.
   */
  async commitBulkTeachers(
    instituteId: string,
    teachers: BulkTeacherRowDto[],
    actor: AuthenticatedUser,
  ): Promise<BulkTeacherCommitResult> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Access denied for this institute.');
    }

    if (!teachers || teachers.length === 0) {
      throw new BadRequestException('No teacher records provided to commit.');
    }

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, plan: true },
    });
    if (!institute) throw new BadRequestException('Institute not found.');

    const limits = await this.entitlements.getLimits(institute.plan);
    const maxTeachers = limits.maxTeachers;
    const currentCount = await this.prisma.teacherProfile.count({
      where: { user: { instituteId } },
    });

    if (maxTeachers !== null && currentCount + teachers.length > maxTeachers) {
      const remainingSlots = Math.max(maxTeachers - currentCount, 0);
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Your ${institute.plan} plan allows up to ${maxTeachers} teachers (remaining: ${remainingSlots}). Enrolling ${teachers.length} teachers would exceed this limit.`,
        details: { plan: institute.plan, limit: maxTeachers, current: currentCount, requested: teachers.length },
      });
    }

    let enrolledCount = 0;
    const failedRows: Array<{ rowNumber: number; name: string; email: string; errors: string[] }> = [];

    const CHUNK_SIZE = 50;
    for (let i = 0; i < teachers.length; i += CHUNK_SIZE) {
      const chunk = teachers.slice(i, i + CHUNK_SIZE);

      await this.prisma.$transaction(async (tx) => {
        for (let j = 0; j < chunk.length; j++) {
          const t = chunk[j]!;
          const originalRowIdx = i + j + 2;

          const existingUser = await tx.user.findFirst({
            where: { instituteId, email: t.email.toLowerCase() },
          });

          if (existingUser) {
            failedRows.push({
              rowNumber: originalRowIdx,
              name: t.name,
              email: t.email,
              errors: [`Email '${t.email}' is already registered in this institute.`],
            });
            continue;
          }

          // Create User
          const user = await tx.user.create({
            data: {
              instituteId,
              email: t.email.toLowerCase().trim(),
              name: t.name.trim(),
              role: UserRole.TEACHER,
              status: UserStatus.ACTIVE,
            },
          });

          // Create TeacherProfile
          const teacherProfile = await tx.teacherProfile.create({
            data: {
              userId: user.id,
              qualification: t.qualification?.trim() || null,
              subjectIds: t.subjectId ? [t.subjectId] : [],
            },
          });

          // Assign Batch if provided
          if (t.batchId) {
            await tx.batchTeacher.create({
              data: {
                batchId: t.batchId,
                teacherProfileId: teacherProfile.id,
              },
            });
          }

          enrolledCount++;
        }
      });
    }

    if (enrolledCount > 0) {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId: actor.id,
          action: AuditAction.CREATE,
          entity: 'teacher_profiles',
          entityId: 'bulk_onboarding',
          newValue: {
            totalAttempted: teachers.length,
            enrolledCount,
            failedCount: failedRows.length,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    return {
      success: enrolledCount > 0,
      enrolledCount,
      failedCount: failedRows.length,
      failedRows,
    };
  }

  /**
   * Generates a targeted Microsoft Excel (.xlsx) workbook containing *only*
   * failed teacher rows with red error reasons.
   */
  async generateErrorReportWorkbook(
    instituteId: string,
    failedRows: Array<{ rowNumber: number; data: any; errors: string[] }>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIOS Faculty Error Remediation Engine';
    const sheet = workbook.addWorksheet('Failed Faculty Records', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Row #', key: 'rowNum', width: 10 },
      { header: 'Error Reasons (Fix and Re-upload)', key: 'reasons', width: 45 },
      { header: 'Full Name *', key: 'name', width: 28 },
      { header: 'Email Address *', key: 'email', width: 32 },
      { header: 'Qualification', key: 'qualification', width: 28 },
      { header: 'Primary Subject *', key: 'subject', width: 26 },
      { header: 'Assigned Batch', key: 'batch', width: 28 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell, colNum) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNum === 2 ? 'FFE11D48' : 'FF065F46' },
      };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    failedRows.forEach((item) => {
      const d = item.data || {};
      const row = sheet.addRow({
        rowNum: item.rowNumber,
        reasons: item.errors.join('; '),
        name: d.name || '',
        email: d.email || '',
        qualification: d.qualification || '',
        subject: d.subjectName || d.subject || '',
        batch: d.batchName || d.batch || '',
      });

      const errCell = row.getCell(2);
      errCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' },
      };
      errCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFE11D48' } };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
