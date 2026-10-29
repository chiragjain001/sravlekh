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
import { UserRole, UserStatus, AuditAction, InstitutePlan } from '@prisma/client';
import { STUDENT_TAG_VALUES, BulkStudentRowDto } from './dto/student.dto';

export interface ValidatedRow {
  rowNumber: number;
  isValid: boolean;
  data: {
    name: string;
    email: string;
    rollNumber?: string;
    batchId?: string;
    batchName?: string;
    dateOfBirth?: string;
    gender?: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    address?: string;
    tags?: string[];
  };
  errors: string[];
}

export interface BulkValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  hasErrors: boolean;
  rows: ValidatedRow[];
  templateVerified: boolean;
}

export interface BulkCommitResult {
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
export class StudentBulkImportService {
  private readonly logger = new Logger(StudentBulkImportService.name);

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
      .update(`${instituteId}:STUDENT_ENROLLMENT_V1`)
      .digest('hex');
  }

  private sanitizeString(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Formula Injection defense (CWE-1236)
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = "'" + str;
    }
    return str;
  }

  /**
   * Generates a context-aware, signed Microsoft Excel (.xlsx) template
   * with live Institute Batches in native in-cell dropdowns and anti-tamper watermark.
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

    // Fetch active batches for this institute
    const batches = await this.prisma.batch.findMany({
      where: { instituteId, isActive: true },
      select: { id: true, name: true, classYear: true, section: true },
      orderBy: [{ name: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIOS Student Enrollment Engine';
    workbook.lastModifiedBy = 'AIOS Registry';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ── Sheet 1: Student Enrollment ──────────────────────────────────────────
    const mainSheet = workbook.addWorksheet('Student Enrollment', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const columns = [
      { header: 'Full Name *', key: 'name', width: 26 },
      { header: 'Email Address *', key: 'email', width: 30 },
      { header: 'Roll Number', key: 'rollNumber', width: 16 },
      { header: 'Batch / Class *', key: 'batch', width: 30 },
      { header: 'Date of Birth (YYYY-MM-DD)', key: 'dateOfBirth', width: 24 },
      { header: 'Gender', key: 'gender', width: 16 },
      { header: 'Guardian Name', key: 'guardianName', width: 24 },
      { header: 'Guardian Phone', key: 'guardianPhone', width: 20 },
      { header: 'Guardian Email', key: 'guardianEmail', width: 28 },
      { header: 'Address', key: 'address', width: 34 },
      { header: 'Tags (comma separated)', key: 'tags', width: 26 },
    ];

    mainSheet.columns = columns;

    // Style Header Row
    const headerRow = mainSheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate 800
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    // ── Sheet 2: _LOOKUPS (Data Validation source) ──────────────────────────
    const lookupSheet = workbook.addWorksheet('_LOOKUPS');
    lookupSheet.state = 'hidden';

    lookupSheet.getCell('A1').value = 'Batch List';
    lookupSheet.getCell('B1').value = 'Gender List';
    lookupSheet.getCell('C1').value = 'Batch ID';

    const genderOptions = ['Male', 'Female', 'Other'];
    genderOptions.forEach((g, idx) => {
      lookupSheet.getCell(`B${idx + 2}`).value = g;
    });

    const batchDisplayNames: string[] = [];
    batches.forEach((b, idx) => {
      const displayName = b.section ? `${b.name} (${b.section})` : b.name;
      batchDisplayNames.push(displayName);
      lookupSheet.getCell(`A${idx + 2}`).value = displayName;
      lookupSheet.getCell(`C${idx + 2}`).value = b.id;
    });

    // Fallback if institute has no batches yet
    if (batchDisplayNames.length === 0) {
      lookupSheet.getCell('A2').value = 'General / Default Batch';
      batchDisplayNames.push('General / Default Batch');
    }

    const maxLookupRow = Math.max(batchDisplayNames.length + 1, 2);

    // Apply native Excel Data Validation dropdowns to rows 2 to 600
    for (let r = 2; r <= 600; r++) {
      // Batch Dropdown (Column D)
      mainSheet.getCell(`D${r}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`_LOOKUPS!$A$2:$A$${maxLookupRow}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Batch Selected',
        error: 'Please choose an active batch from the dropdown list.',
      };

      // Gender Dropdown (Column F)
      mainSheet.getCell(`F${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['_LOOKUPS!$B$2:$B$4'],
        showErrorMessage: true,
        errorTitle: 'Invalid Gender',
        error: 'Please choose Male, Female, or Other from the dropdown list.',
      };
    }

    // Add 2 Guide / Sample Rows (Sample 1 & Sample 2)
    const sampleBatch = batchDisplayNames[0] || 'Grade 10';
    const sampleRows = [
      {
        name: 'Aarav Sharma (Sample)',
        email: 'aarav.sample@school.edu',
        rollNumber: '101',
        batch: sampleBatch,
        dateOfBirth: '2010-04-15',
        gender: 'Male',
        guardianName: 'Rajesh Sharma',
        guardianPhone: '9876543210',
        guardianEmail: 'rajesh.sharma@parent.com',
        address: '14 Civil Lines, Delhi',
        tags: 'fast-learner',
      },
      {
        name: 'Ananya Verma (Sample)',
        email: 'ananya.sample@school.edu',
        rollNumber: '102',
        batch: sampleBatch,
        dateOfBirth: '2010-08-22',
        gender: 'Female',
        guardianName: 'Sanjay Verma',
        guardianPhone: '9812345678',
        guardianEmail: 'sanjay.verma@parent.com',
        address: '28 MG Road, Bengaluru',
        tags: 'needs-revision',
      },
    ];

    sampleRows.forEach((s) => {
      const row = mainSheet.addRow(s);
      row.font = { italic: true, color: { argb: 'FF64748B' }, size: 9.5 };
    });

    // ── Sheet 3: _AIOS_SYSTEM_META (Anti-tamper & institute verification) ────
    const metaSheet = workbook.addWorksheet('_AIOS_SYSTEM_META');
    metaSheet.state = 'veryHidden';

    const signature = this.generateSignature(instituteId);
    metaSheet.getCell('A1').value = 'INSTITUTE_ID';
    metaSheet.getCell('B1').value = instituteId;
    metaSheet.getCell('A2').value = 'TEMPLATE_TYPE';
    metaSheet.getCell('B2').value = 'STUDENT_ENROLLMENT_V1';
    metaSheet.getCell('A3').value = 'TIMESTAMP';
    metaSheet.getCell('B3').value = new Date().toISOString();
    metaSheet.getCell('A4').value = 'SIGNATURE';
    metaSheet.getCell('B4').value = signature;
    metaSheet.getCell('A5').value = 'VERSION';
    metaSheet.getCell('B5').value = '1.0';

    const safeInstituteName = institute.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `AIOS_Students_Enrollment_${safeInstituteName}_${dateStr}.xlsx`;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, filename };
  }

  /**
   * Validates an uploaded Excel workbook against institute data, checking
   * signature, column headers, duplicate emails, roll numbers, and batch mappings.
   */
  async validateUpload(
    instituteId: string,
    fileBuffer: Buffer,
    actor: AuthenticatedUser,
  ): Promise<BulkValidationResult> {
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

    // 1. Check template signature
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

    // 2. Load primary worksheet
    const sheet = workbook.getWorksheet('Student Enrollment') || workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('The uploaded workbook does not contain any readable sheets.');
    }

    // 3. Load active batches for lookup resolution
    const batches = await this.prisma.batch.findMany({
      where: { instituteId },
      select: { id: true, name: true, section: true },
    });

    const batchMap = new Map<string, { id: string; name: string }>();
    batches.forEach((b) => {
      const normalizedName = b.name.trim().toLowerCase();
      batchMap.set(normalizedName, { id: b.id, name: b.name });
      if (b.section) {
        batchMap.set(`${normalizedName} (${b.section.toLowerCase()})`, { id: b.id, name: b.name });
      }
      batchMap.set(b.id, { id: b.id, name: b.name });
    });

    // 4. Pre-fetch existing users in this institute for duplicate email checks
    const existingUsers = await this.prisma.user.findMany({
      where: { instituteId, role: UserRole.STUDENT },
      select: { email: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    // Pre-fetch existing roll numbers per batch
    const existingRolls = await this.prisma.studentProfile.findMany({
      where: { instituteId, rollNumber: { not: null } },
      select: { batchId: true, rollNumber: true },
    });
    const existingRollMap = new Set<string>();
    existingRolls.forEach((r) => {
      if (r.batchId && r.rollNumber) {
        existingRollMap.add(`${r.batchId}:${r.rollNumber.trim().toLowerCase()}`);
      }
    });

    const seenEmailsInFile = new Set<string>();
    const seenRollsInFile = new Set<string>();
    const validatedRows: ValidatedRow[] = [];

    // Process rows starting from row 2
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      // Extract raw cell values
      const rawName = this.sanitizeString(row.getCell(1).text || row.getCell(1).value);
      const rawEmail = this.sanitizeString(row.getCell(2).text || row.getCell(2).value);
      const rawRoll = this.sanitizeString(row.getCell(3).text || row.getCell(3).value);
      const rawBatch = this.sanitizeString(row.getCell(4).text || row.getCell(4).value);
      const rawDob = this.sanitizeString(row.getCell(5).text || row.getCell(5).value);
      const rawGender = this.sanitizeString(row.getCell(6).text || row.getCell(6).value);
      const rawGuardianName = this.sanitizeString(row.getCell(7).text || row.getCell(7).value);
      const rawGuardianPhone = this.sanitizeString(row.getCell(8).text || row.getCell(8).value);
      const rawGuardianEmail = this.sanitizeString(row.getCell(9).text || row.getCell(9).value);
      const rawAddress = this.sanitizeString(row.getCell(10).text || row.getCell(10).value);
      const rawTags = this.sanitizeString(row.getCell(11).text || row.getCell(11).value);

      // If entirely empty row, ignore
      if (!rawName && !rawEmail && !rawBatch && !rawRoll) {
        return;
      }

      // Skip sample rows if unchanged
      if (rawName.includes('(Sample)') || rawEmail.includes('.sample@')) {
        return;
      }

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
        errors.push(`Email already enrolled in this institute: '${rawEmail}'.`);
      } else {
        seenEmailsInFile.add(lowerEmail);
      }

      // Validate Batch
      let resolvedBatchId: string | undefined;
      let resolvedBatchName: string | undefined;

      if (!rawBatch) {
        errors.push('Batch / Class selection is required.');
      } else {
        const normalizedInput = rawBatch.trim().toLowerCase();
        const matched = batchMap.get(normalizedInput);
        if (matched) {
          resolvedBatchId = matched.id;
          resolvedBatchName = matched.name;
        } else {
          errors.push(`Batch '${rawBatch}' was not found in this institute.`);
        }
      }

      // Validate Roll Number
      if (rawRoll && resolvedBatchId) {
        const rollKey = `${resolvedBatchId}:${rawRoll.trim().toLowerCase()}`;
        if (seenRollsInFile.has(rollKey)) {
          errors.push(`Duplicate roll number '${rawRoll}' within batch '${resolvedBatchName}' in this file.`);
        } else if (existingRollMap.has(rollKey)) {
          errors.push(`Roll number '${rawRoll}' already assigned to another student in batch '${resolvedBatchName}'.`);
        } else {
          seenRollsInFile.add(rollKey);
        }
      }

      // Validate Date of Birth
      let formattedDob: string | undefined;
      if (rawDob) {
        const parsedDate = new Date(rawDob);
        if (isNaN(parsedDate.getTime())) {
          errors.push(`Invalid Date of Birth: '${rawDob}'. Expected format: YYYY-MM-DD.`);
        } else {
          formattedDob = parsedDate.toISOString().slice(0, 10);
        }
      }

      // Validate Gender
      if (rawGender) {
        const g = rawGender.trim().toLowerCase();
        if (g !== 'male' && g !== 'female' && g !== 'other') {
          errors.push(`Invalid gender '${rawGender}'. Allowed values: Male, Female, Other.`);
        }
      }

      // Validate Guardian Email
      if (rawGuardianEmail && !emailRegex.test(rawGuardianEmail.toLowerCase())) {
        errors.push(`Invalid guardian email format: '${rawGuardianEmail}'.`);
      }

      // Validate Tags
      const tagsList: string[] = [];
      if (rawTags) {
        const tokens = rawTags.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
        for (const token of tokens) {
          if (!STUDENT_TAG_VALUES.includes(token as any)) {
            errors.push(`Unknown student tag: '${token}'.`);
          } else {
            tagsList.push(token);
          }
        }
      }

      validatedRows.push({
        rowNumber,
        isValid: errors.length === 0,
        data: {
          name: rawName,
          email: lowerEmail,
          rollNumber: rawRoll || undefined,
          batchId: resolvedBatchId,
          batchName: resolvedBatchName || rawBatch,
          dateOfBirth: formattedDob,
          gender: rawGender || undefined,
          guardianName: rawGuardianName || undefined,
          guardianPhone: rawGuardianPhone || undefined,
          guardianEmail: rawGuardianEmail || undefined,
          address: rawAddress || undefined,
          tags: tagsList.length > 0 ? tagsList : undefined,
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
   * Commits an array of validated student records in transactional chunks,
   * enforcing institute plan limits and logging an atomic audit trail.
   */
  async commitBulkStudents(
    instituteId: string,
    students: BulkStudentRowDto[],
    actor: AuthenticatedUser,
  ): Promise<BulkCommitResult> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Access denied for this institute.');
    }

    if (!students || students.length === 0) {
      throw new BadRequestException('No student records provided to commit.');
    }

    // 1. Verify institute & plan limits beforehand
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, plan: true, trialEndsAt: true },
    });
    if (!institute) {
      throw new BadRequestException('Institute not found.');
    }

    const limits = await this.entitlements.getLimits(institute.plan);
    const maxStudents = limits.maxStudents;
    const currentCount = await this.prisma.studentProfile.count({
      where: { instituteId },
    });

    if (maxStudents !== null && currentCount + students.length > maxStudents) {
      const remainingSlots = Math.max(maxStudents - currentCount, 0);
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Your ${institute.plan} plan allows up to ${maxStudents} students (remaining slots: ${remainingSlots}). Enrolling ${students.length} students would exceed this quota.`,
        details: { plan: institute.plan, limit: maxStudents, current: currentCount, requested: students.length },
      });
    }

    let enrolledCount = 0;
    const failedRows: Array<{ rowNumber: number; name: string; email: string; errors: string[] }> = [];

    // Process in sequential chunks of 50 to maintain atomicity and prevent DB connection starvation
    const CHUNK_SIZE = 50;
    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);

      await this.prisma.$transaction(async (tx) => {
        for (let j = 0; j < chunk.length; j++) {
          const s = chunk[j]!;
          const originalRowIdx = i + j + 2;

          // Double check email uniqueness in transaction
          const existingUser = await tx.user.findFirst({
            where: { instituteId, email: s.email.toLowerCase() },
          });

          if (existingUser) {
            failedRows.push({
              rowNumber: originalRowIdx,
              name: s.name,
              email: s.email,
              errors: [`Email '${s.email}' is already enrolled in this institute.`],
            });
            continue;
          }

          // Create User
          const user = await tx.user.create({
            data: {
              instituteId,
              email: s.email.toLowerCase().trim(),
              name: s.name.trim(),
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
            },
          });

          // Create StudentProfile
          await tx.studentProfile.create({
            data: {
              userId: user.id,
              instituteId,
              rollNumber: s.rollNumber?.trim() || null,
              batchId: s.batchId || null,
              dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
              guardianName: s.guardianName?.trim() || null,
              guardianPhone: s.guardianPhone?.trim() || null,
              guardianEmail: s.guardianEmail?.toLowerCase().trim() || null,
              address: s.address?.trim() || null,
              tags: s.tags || [],
            },
          });

          enrolledCount++;
        }
      });
    }

    // Write bulk audit log
    if (enrolledCount > 0) {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId: actor.id,
          action: AuditAction.CREATE,
          entity: 'student_profiles',
          entityId: 'bulk_enrollment',
          newValue: {
            totalAttempted: students.length,
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
   * Generates a targeted Microsoft Excel (.xlsx) workbook containing *only* the
   * failed rows with highlighted cells and a prominent red "Error Reasons" column,
   * preserving native dropdowns so the admin can fix and re-upload in 1 click.
   */
  async generateErrorReportWorkbook(
    instituteId: string,
    failedRows: Array<{ rowNumber: number; data: any; errors: string[] }>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIOS Error Remediation Engine';
    const sheet = workbook.addWorksheet('Failed Student Records', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const columns = [
      { header: 'Row #', key: 'rowNum', width: 10 },
      { header: 'Error Reasons (Fix and Re-upload)', key: 'reasons', width: 45 },
      { header: 'Full Name *', key: 'name', width: 26 },
      { header: 'Email Address *', key: 'email', width: 30 },
      { header: 'Roll Number', key: 'rollNumber', width: 16 },
      { header: 'Batch / Class *', key: 'batch', width: 30 },
      { header: 'Date of Birth (YYYY-MM-DD)', key: 'dateOfBirth', width: 24 },
      { header: 'Gender', key: 'gender', width: 16 },
      { header: 'Guardian Name', key: 'guardianName', width: 24 },
      { header: 'Guardian Phone', key: 'guardianPhone', width: 20 },
      { header: 'Guardian Email', key: 'guardianEmail', width: 28 },
      { header: 'Address', key: 'address', width: 34 },
      { header: 'Tags', key: 'tags', width: 26 },
    ];
    sheet.columns = columns;

    // Header styling with red alert emphasis
    const headerRow = sheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell, colNum) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNum === 2 ? 'FFE11D48' : 'FF1E293B' }, // Rose 600 for error column
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
        rollNumber: d.rollNumber || '',
        batch: d.batchName || d.batch || '',
        dateOfBirth: d.dateOfBirth || '',
        gender: d.gender || '',
        guardianName: d.guardianName || '',
        guardianPhone: d.guardianPhone || '',
        guardianEmail: d.guardianEmail || '',
        address: d.address || '',
        tags: Array.isArray(d.tags) ? d.tags.join(', ') : d.tags || '',
      });

      // Highlight the error reason cell with soft rose background
      const errCell = row.getCell(2);
      errCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' }, // Rose 50
      };
      errCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFE11D48' } };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
