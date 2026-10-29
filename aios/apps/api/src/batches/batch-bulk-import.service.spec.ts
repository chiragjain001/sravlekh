import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole, AuditAction } from '@prisma/client';
import { BatchBulkImportService } from './batch-bulk-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthenticatedUser } from '../auth/auth.types';
import ExcelJS from 'exceljs';

describe('BatchBulkImportService — Production Hardening & Tenant Isolation', () => {
  let service: BatchBulkImportService;
  let prisma: any;
  let entitlements: any;

  const instituteId = 'inst-apex-101';
  const otherInstituteId = 'inst-other-999';

  const adminActor: AuthenticatedUser = {
    id: 'user-admin-1',
    email: 'admin@apex.edu',
    name: 'Admin User',
    role: UserRole.ADMIN,
    instituteId,
  };

  const branches = [
    { id: 'branch-main', name: 'Main Campus' },
    { id: 'branch-north', name: 'North Branch' },
  ];

  const existingBatches = [
    { id: 'batch-10a', name: 'Class 10 - Section A' },
  ];

  beforeEach(async () => {
    prisma = {
      institute: {
        findUnique: jest.fn().mockResolvedValue({
          id: instituteId,
          name: 'Apex Academy',
        }),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue(branches),
      },
      batch: {
        findMany: jest.fn().mockResolvedValue(existingBatches),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `batch-${Math.random().toString(36).slice(2)}`, ...data }),
        ),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    entitlements = {
      checkTierLimits: jest.fn().mockResolvedValue({ allowed: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchBulkImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<BatchBulkImportService>(BatchBulkImportService);
  });

  describe('generateTemplate', () => {
    it('rejects an admin downloading a template for another institute (tenant isolation)', async () => {
      await expect(
        service.generateTemplate(otherInstituteId, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('generates a valid .xlsx template with active institute branches and watermark signature', async () => {
      const { buffer, filename } = await service.generateTemplate(instituteId, adminActor);

      expect(filename).toContain('AIOS_Batches_Setup_Apex_Academy.xlsx');
      expect(buffer).toBeInstanceOf(Buffer);

      // Verify Excel contents
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const instructions = wb.getWorksheet('Instructions');
      const batchesSheet = wb.getWorksheet('Batches');
      const lookups = wb.getWorksheet('_LOOKUPS');
      const meta = wb.getWorksheet('_METADATA');

      expect(instructions).toBeDefined();
      expect(batchesSheet).toBeDefined();
      expect(lookups).toBeDefined();
      expect(meta).toBeDefined();

      // Check header row in Batches sheet
      const h1 = batchesSheet?.getRow(1).getCell(1).text;
      expect(h1).toContain('Batch Name');

      // Check watermark in meta
      let foundSig = false;
      meta?.eachRow((row) => {
        if (row.getCell(1).text === 'signature' && row.getCell(2).text.length > 20) {
          foundSig = true;
        }
      });
      expect(foundSig).toBe(true);
    });
  });

  describe('validateUpload', () => {
    it('successfully validates a well-formed template containing valid batches', async () => {
      const { buffer } = await service.generateTemplate(instituteId, adminActor);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Batches')!;

      // Add 2 valid rows
      sheet.addRow(['Class 11 - JEE Alpha', 'Class 11', 'Alpha', '2025-2026', 'Main Campus']);
      sheet.addRow(['Class 12 - NEET Beta', 'Class 12', 'Beta', '2025-2026', 'North Branch']);

      const testBuffer = Buffer.from(await wb.xlsx.writeBuffer());
      const res = await service.validateUpload(instituteId, testBuffer, adminActor);

      expect(res.templateVerified).toBe(true);
      expect(res.totalRows).toBeGreaterThanOrEqual(2);
      expect(res.hasErrors).toBe(false);
      expect(res.validCount).toBe(res.totalRows);
    });

    it('detects duplicate batch names within file and against database', async () => {
      const { buffer } = await service.generateTemplate(instituteId, adminActor);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Batches')!;

      // Row 1: conflicts with existing database batch ('Class 10 - Section A')
      sheet.addRow(['Class 10 - Section A', 'Class 10', 'A', '2025-2026', 'Main Campus']);
      // Row 2 & 3: duplicated batch name in file
      sheet.addRow(['Class 9 - Batch X', 'Class 9', 'X', '2025-2026', 'Main Campus']);
      sheet.addRow(['Class 9 - Batch X', 'Class 9', 'X', '2025-2026', 'Main Campus']);

      const testBuffer = Buffer.from(await wb.xlsx.writeBuffer());
      const res = await service.validateUpload(instituteId, testBuffer, adminActor);

      expect(res.hasErrors).toBe(true);
      const dbConflict = res.rows.find((r) => r.data.name === 'Class 10 - Section A');
      expect(dbConflict?.isValid).toBe(false);
      expect(dbConflict?.errors[0]).toContain('already exists in this institute');

      const fileDup = res.rows.filter((r) => r.data.name === 'Class 9 - Batch X');
      expect(fileDup.length).toBe(2);
      expect(fileDup[1]!.isValid).toBe(false);
      expect(fileDup[1]!.errors[0]).toContain('Duplicate batch name');
    });

    it('flags unknown branches not found in institute', async () => {
      const { buffer } = await service.generateTemplate(instituteId, adminActor);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Batches')!;

      sheet.addRow(['Class 8 - Alpha', 'Class 8', 'Alpha', '2025-2026', 'Atlantis Campus']);

      const testBuffer = Buffer.from(await wb.xlsx.writeBuffer());
      const res = await service.validateUpload(instituteId, testBuffer, adminActor);

      const invalidRow = res.rows.find((r) => r.data.name === 'Class 8 - Alpha');
      expect(invalidRow?.isValid).toBe(false);
      expect(invalidRow?.errors[0]).toContain('Unknown branch');
    });
  });

  describe('commitBulkBatches', () => {
    it('creates Batch records and logs AuditLog', async () => {
      const dtos = [
        {
          name: 'Class 11 - Science A',
          classYear: 'Class 11',
          section: 'A',
          academicYear: '2025-2026',
        },
        {
          name: 'Class 11 - Science B',
          classYear: 'Class 11',
          section: 'B',
          academicYear: '2025-2026',
        },
      ];

      const res = await service.commitBulkBatches(instituteId, dtos, adminActor);

      expect(res.success).toBe(true);
      expect(res.enrolledCount).toBe(2);
      expect(res.failedCount).toBe(0);

      expect(prisma.batch.create).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId,
            action: AuditAction.CREATE,
            entity: 'Batch',
          }),
        }),
      );
    });
  });

  describe('generateErrorReportWorkbook', () => {
    it('generates an Excel remediation workbook for failed batches', async () => {
      const failed = [
        { rowNumber: 4, name: 'Duplicate Batch', errors: ['Name already taken'] },
      ];

      const { buffer, filename } = await service.generateErrorReportWorkbook(
        instituteId,
        failed,
        adminActor,
      );

      expect(filename).toContain('AIOS_Failed_Batches_Remediation.xlsx');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Remediation Required');
      expect(sheet).toBeDefined();
      expect(sheet?.rowCount).toBeGreaterThanOrEqual(2);
    });
  });
});
