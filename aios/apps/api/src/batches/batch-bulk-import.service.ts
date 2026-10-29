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
import { UserRole, AuditAction } from '@prisma/client';
import { BulkBatchRowDto } from './dto/batch.dto';

export interface ValidatedBatchRow {
  rowNumber: number;
  isValid: boolean;
  data: {
    name: string;
    classYear?: string;
    section?: string;
    academicYear?: string;
    branchName?: string;
    branchId?: string;
  };
  errors: string[];
}

export interface BulkBatchValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  hasErrors: boolean;
  rows: ValidatedBatchRow[];
  templateVerified: boolean;
}

export interface BulkBatchCommitResult {
  success: boolean;
  enrolledCount: number;
  failedCount: number;
  failedRows: Array<{
    rowNumber: number;
    name: string;
    errors: string[];
  }>;
}

@Injectable()
export class BatchBulkImportService {
  private readonly logger = new Logger(BatchBulkImportService.name);

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
      .update(`${instituteId}:BATCH_CREATION_V1`)
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
   * with live Institute Branches and standard Class/Section dropdowns and anti-tamper watermark.
   */
  async generateTemplate(
    instituteId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Tenant Isolation: Cannot access templates for another institute.');
    }

    const [institute, branches] = await Promise.all([
      this.prisma.institute.findUnique({
        where: { id: instituteId },
        select: { id: true, name: true },
      }),
      this.prisma.branch.findMany({
        where: { instituteId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (!institute) {
      throw new BadRequestException('Institute not found.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIOS Academic Intelligence OS';
    workbook.created = new Date();

    // 1. Instructions Sheet
    const infoSheet = workbook.addWorksheet('Instructions', {
      views: [{ showGridLines: true }],
    });
    infoSheet.columns = [{ width: 4 }, { width: 32 }, { width: 68 }];

    infoSheet.addRow([]);
    const titleRow = infoSheet.addRow(['', 'AIOS BATCH SETUP WORKBOOK', '']);
    titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };

    infoSheet.addRow(['', 'Institute Name:', institute.name]);
    infoSheet.addRow(['', 'Generated On:', new Date().toLocaleString()]);
    infoSheet.addRow([]);

    const steps = [
      ['1. Purpose', 'Bulk register academic batches, classes, and sections in one structured sheet.'],
      ['2. Batch Name (Required)', 'Must be unique across the institute (e.g., "Class 10 - Section A", "JEE 2026 - Alpha").'],
      ['3. Class / Grade Level', 'Select from the dropdown (Class 6 - 12, Foundation, Dropper, etc.) or type custom.'],
      ['4. Section', 'Select section from dropdown (A, B, C, D, Alpha, Beta) or leave blank if not applicable.'],
      ['5. Academic Year', 'Select academic cycle (e.g. 2025-2026, 2026-2027).'],
      ['6. Branch / Campus', 'Select branch if your institute operates multiple campuses.'],
      ['7. Anti-Tamper Security', 'Do not alter the hidden signature sheet; doing so will invalidate the template.'],
    ];

    for (const [stepTitle, desc] of steps) {
      const r = infoSheet.addRow(['', stepTitle, desc]);
      r.getCell(2).font = { bold: true, color: { argb: 'FF334155' } };
      r.getCell(3).font = { color: { argb: 'FF475569' } };
    }

    // 2. Hidden Lookups Sheet
    const lookupSheet = workbook.addWorksheet('_LOOKUPS', { state: 'hidden' });
    const classYears = [
      'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
      'Class 11', 'Class 12', 'Foundation', 'JEE Main', 'JEE Advanced', 'NEET Dropper',
    ];
    const sections = ['A', 'B', 'C', 'D', 'E', 'Alpha', 'Beta', 'Gamma', 'Delta'];
    const academicYears = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];
    const branchNames = branches.length > 0 ? branches.map((b) => b.name) : ['Main Campus'];

    const maxLookupLen = Math.max(classYears.length, sections.length, academicYears.length, branchNames.length);
    lookupSheet.addRow(['ClassYears', 'Sections', 'AcademicYears', 'Branches']);

    for (let i = 0; i < maxLookupLen; i++) {
      lookupSheet.addRow([
        classYears[i] || '',
        sections[i] || '',
        academicYears[i] || '',
        branchNames[i] || '',
      ]);
    }

    // 3. Batches Entry Sheet
    const dataSheet = workbook.addWorksheet('Batches', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
    });

    dataSheet.columns = [
      { header: 'Batch Name *', key: 'name', width: 34 },
      { header: 'Class / Grade Level', key: 'classYear', width: 22 },
      { header: 'Section', key: 'section', width: 16 },
      { header: 'Academic Year', key: 'academicYear', width: 18 },
      { header: 'Branch / Campus', key: 'branchName', width: 24 },
    ];

    // Header styling
    const headerRow = dataSheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Provide 50 pre-formatted rows with in-cell native data validation
    for (let r = 2; r <= 50; r++) {
      const row = dataSheet.getRow(r);
      row.height = 20;

      // Class Year Validation (Column B)
      row.getCell(2).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_LOOKUPS!$A$2:$A$${classYears.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Class',
        error: 'Please choose a valid class from the list or add new.',
      };

      // Section Validation (Column C)
      row.getCell(3).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_LOOKUPS!$B$2:$B$${sections.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Section',
        error: 'Please select a valid section from the list.',
      };

      // Academic Year Validation (Column D)
      row.getCell(4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_LOOKUPS!$C$2:$C$${academicYears.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Academic Year',
        error: 'Please choose an academic year from the dropdown.',
      };

      // Branch Validation (Column E)
      row.getCell(5).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_LOOKUPS!$D$2:$D$${branchNames.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Branch',
        error: 'Please select a valid campus branch.',
      };
    }

    // Example row
    dataSheet.addRow({
      name: 'Class 10 - Section A (Sample)',
      classYear: 'Class 10',
      section: 'A',
      academicYear: '2025-2026',
      branchName: branchNames[0] || 'Main Campus',
    });

    // 4. Hidden Metadata Sheet
    const metaSheet = workbook.addWorksheet('_METADATA', { state: 'hidden' });
    metaSheet.addRow(['key', 'value']);
    metaSheet.addRow(['instituteId', instituteId]);
    metaSheet.addRow(['schemaVersion', 'BATCH_CREATION_V1']);
    metaSheet.addRow(['timestamp', new Date().toISOString()]);
    metaSheet.addRow(['signature', this.generateSignature(instituteId)]);

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    const safeInstituteName = institute.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `AIOS_Batches_Setup_${safeInstituteName}.xlsx`;

    return { buffer, filename };
  }

  /**
   * Pre-commit Dry-Run Validation of uploaded workbook
   */
  async validateUpload(
    instituteId: string,
    fileBuffer: Buffer,
    actor: AuthenticatedUser,
  ): Promise<BulkBatchValidationResult> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Tenant Isolation: Cannot validate batch data for another institute.');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch {
      throw new BadRequestException('Failed to parse uploaded Excel file. Ensure it is a valid .xlsx file.');
    }

    // 1. Watermark Verification
    let templateVerified = false;
    const metaSheet = workbook.getWorksheet('_METADATA');
    if (metaSheet) {
      let sheetInstituteId = '';
      let signature = '';
      metaSheet.eachRow((row) => {
        const key = row.getCell(1).text?.trim();
        const val = row.getCell(2).text?.trim();
        if (key === 'instituteId') sheetInstituteId = val;
        if (key === 'signature') signature = val;
      });

      if (sheetInstituteId === instituteId) {
        const expectedSig = this.generateSignature(instituteId);
        if (signature === expectedSig) {
          templateVerified = true;
        }
      }
    }

    // 2. Locate Data Sheet
    const dataSheet = workbook.getWorksheet('Batches') || workbook.worksheets[0];
    if (!dataSheet) {
      throw new BadRequestException('No valid worksheet found in the uploaded workbook.');
    }

    // 3. Pre-fetch existing institute batches & branches
    const [existingBatches, branches] = await Promise.all([
      this.prisma.batch.findMany({
        where: { instituteId },
        select: { id: true, name: true },
      }),
      this.prisma.branch.findMany({
        where: { instituteId },
        select: { id: true, name: true },
      }),
    ]);

    const existingNamesLower = new Set(existingBatches.map((b) => b.name.trim().toLowerCase()));
    const branchMap = new Map<string, string>();
    for (const br of branches) {
      branchMap.set(br.name.trim().toLowerCase(), br.id);
    }

    // Find column indexes by header
    const headerRow = dataSheet.getRow(1);
    const colIndex: {
      name: number;
      classYear: number;
      section: number;
      academicYear: number;
      branchName: number;
    } = {
      name: 1,
      classYear: 2,
      section: 3,
      academicYear: 4,
      branchName: 5,
    };

    headerRow.eachCell((cell, colNum) => {
      const txt = cell.text.trim().toLowerCase();
      if (txt.includes('batch name') || txt === 'name') colIndex.name = colNum;
      else if (txt.includes('class') || txt.includes('grade')) colIndex.classYear = colNum;
      else if (txt.includes('section')) colIndex.section = colNum;
      else if (txt.includes('academic year') || txt.includes('year')) colIndex.academicYear = colNum;
      else if (txt.includes('branch') || txt.includes('campus')) colIndex.branchName = colNum;
    });

    const validatedRows: ValidatedBatchRow[] = [];
    const seenNamesInFile = new Set<string>();

    dataSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const nameRaw = row.getCell(colIndex.name).text?.trim();
      const classYearRaw = row.getCell(colIndex.classYear).text?.trim();
      const sectionRaw = row.getCell(colIndex.section).text?.trim();
      const academicYearRaw = row.getCell(colIndex.academicYear).text?.trim();
      const branchNameRaw = row.getCell(colIndex.branchName).text?.trim();

      // Skip completely empty rows
      if (!nameRaw && !classYearRaw && !sectionRaw && !academicYearRaw) {
        return;
      }

      // Skip sample rows if unchanged
      if (nameRaw && nameRaw.includes('(Sample)')) {
        return;
      }

      const errors: string[] = [];

      // Validate Batch Name
      if (!nameRaw) {
        errors.push('Batch Name is required');
      } else if (nameRaw.length < 2 || nameRaw.length > 100) {
        errors.push('Batch Name must be between 2 and 100 characters');
      } else {
        const lowerName = nameRaw.toLowerCase();
        if (existingNamesLower.has(lowerName)) {
          errors.push(`A batch named "${nameRaw}" already exists in this institute`);
        } else if (seenNamesInFile.has(lowerName)) {
          errors.push(`Duplicate batch name "${nameRaw}" found multiple times in this spreadsheet`);
        } else {
          seenNamesInFile.add(lowerName);
        }
      }

      // Validate Branch if supplied
      let resolvedBranchId: string | undefined;
      if (branchNameRaw && branchNameRaw.toLowerCase() !== 'main campus') {
        const bId = branchMap.get(branchNameRaw.toLowerCase());
        if (bId) {
          resolvedBranchId = bId;
        } else if (branches.length > 0) {
          errors.push(`Unknown branch "${branchNameRaw}". Valid branches: ${branches.map((b) => b.name).join(', ')}`);
        }
      }

      validatedRows.push({
        rowNumber,
        isValid: errors.length === 0,
        data: {
          name: nameRaw || '',
          classYear: classYearRaw || undefined,
          section: sectionRaw || undefined,
          academicYear: academicYearRaw || undefined,
          branchName: branchNameRaw || undefined,
          branchId: resolvedBranchId,
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
   * Commits validated batch records atomically
   */
  async commitBulkBatches(
    instituteId: string,
    dtos: BulkBatchRowDto[],
    actor: AuthenticatedUser,
  ): Promise<BulkBatchCommitResult> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Tenant Isolation: Cannot create batches for another institute.');
    }

    if (!dtos || dtos.length === 0) {
      throw new BadRequestException('No batch records supplied for bulk creation.');
    }

    const failedRows: BulkBatchCommitResult['failedRows'] = [];
    let enrolledCount = 0;

    // Check existing names to prevent duplicates
    const existing = await this.prisma.batch.findMany({
      where: { instituteId },
      select: { name: true },
    });
    const existingSet = new Set(existing.map((b) => b.name.trim().toLowerCase()));

    // Create batches in transaction chunks
    await this.prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < dtos.length; i++) {
          const item = dtos[i];
          if (!item) continue;
          const nameClean = item.name?.trim();

          if (!nameClean || nameClean.length < 2) {
            failedRows.push({
              rowNumber: i + 2,
              name: nameClean || 'Unknown',
              errors: ['Batch Name is required and must be at least 2 characters'],
            });
            continue;
          }

          if (existingSet.has(nameClean.toLowerCase())) {
            failedRows.push({
              rowNumber: i + 2,
              name: nameClean,
              errors: [`Batch with name "${nameClean}" already exists in institute`],
            });
            continue;
          }

          try {
            await tx.batch.create({
              data: {
                instituteId,
                name: nameClean,
                classYear: item.classYear?.trim() || null,
                section: item.section?.trim() || null,
                academicYear: item.academicYear?.trim() || null,
                branchId: item.branchId || null,
                isActive: true,
              },
            });
            existingSet.add(nameClean.toLowerCase());
            enrolledCount++;
          } catch (err: any) {
            failedRows.push({
              rowNumber: i + 2,
              name: nameClean,
              errors: [err.message || 'Database error occurred during batch creation'],
            });
          }
        }

        // Insert audit log (insert-only)
        await tx.auditLog.create({
          data: {
            instituteId,
            actorId: actor.id,
            action: AuditAction.CREATE,
            entity: 'Batch',
            entityId: instituteId,
            newValue: {
              bulkBatchCount: enrolledCount,
              failedCount: failedRows.length,
            },
          },
        });
      },
      { timeout: 30000 },
    );

    return {
      success: failedRows.length === 0,
      enrolledCount,
      failedCount: failedRows.length,
      failedRows,
    };
  }

  /**
   * Generates an Excel remediation workbook containing only the failed rows with clear error notes
   */
  async generateErrorReportWorkbook(
    instituteId: string,
    failedRows: Array<{ rowNumber: number; name?: string; reason?: string; errors?: string[] }>,
    actor: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Tenant Isolation: Cannot access error report for another institute.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AIOS Bulk Remediation Assistant';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Remediation Required', {
      views: [{ showGridLines: true }],
    });

    sheet.columns = [
      { header: 'Original Row #', key: 'rowNum', width: 16 },
      { header: 'Batch Name', key: 'name', width: 34 },
      { header: 'Identified Issue & Remediation Guidance', key: 'reason', width: 60 },
    ];

    const header = sheet.getRow(1);
    header.height = 28;
    header.eachCell((c) => {
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF991B1B' },
      };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    for (const f of failedRows) {
      const errText = f.reason || (f.errors ? f.errors.join('; ') : 'Validation error');
      const row = sheet.addRow({
        rowNum: f.rowNumber,
        name: this.sanitizeString(f.name),
        reason: errText,
      });

      row.getCell(3).font = { color: { argb: 'FFDC2626' }, bold: true };
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(rawBuffer),
      filename: `AIOS_Failed_Batches_Remediation.xlsx`,
    };
  }
}
