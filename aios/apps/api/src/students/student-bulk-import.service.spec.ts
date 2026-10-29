import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole, InstitutePlan, AuditAction } from '@prisma/client';
import { StudentBulkImportService } from './student-bulk-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthenticatedUser } from '../auth/auth.types';
import ExcelJS from 'exceljs';

describe('StudentBulkImportService — Production Hardening & Tenant Isolation', () => {
  let service: StudentBulkImportService;
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

  const batches = [
    { id: 'batch-10a', name: 'Class 10 - Section A', classYear: 'Class 10', section: 'A' },
    { id: 'batch-11b', name: 'Class 11 - Section B', classYear: 'Class 11', section: 'B' },
  ];

  beforeEach(async () => {
    prisma = {
      institute: {
        findUnique: jest.fn().mockResolvedValue({
          id: instituteId,
          name: 'Apex Academy',
          plan: InstitutePlan.PRO,
        }),
      },
      batch: {
        findMany: jest.fn().mockResolvedValue(batches),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `user-${Math.random().toString(36).slice(2)}`, ...data }),
        ),
      },
      studentProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(10),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `sp-${Math.random().toString(36).slice(2)}`, ...data }),
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
      getLimits: jest.fn().mockResolvedValue({
        maxStudents: 500,
        maxTeachers: 50,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentBulkImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<StudentBulkImportService>(StudentBulkImportService);
  });

  describe('generateTemplate', () => {
    it('rejects an admin downloading a template for another institute (IDOR protection)', async () => {
      await expect(
        service.generateTemplate(otherInstituteId, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('generates a valid .xlsx template with active institute batches, lookup data, and watermark signature', async () => {
      const { buffer, filename } = await service.generateTemplate(instituteId, adminActor);

      expect(filename).toContain('AIOS_Students_Enrollment');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);

      // Verify workbook structure via ExcelJS
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      // Sheet 1: Main Enrollment Sheet
      const mainSheet = wb.getWorksheet('Student Enrollment');
      expect(mainSheet).toBeDefined();
      expect(mainSheet!.getCell('A1').value).toBe('Full Name *');
      expect(mainSheet!.getCell('B1').value).toBe('Email Address *');
      expect(mainSheet!.getCell('D1').value).toBe('Batch / Class *');

      // Sheet 2: _LOOKUPS (Data Validation)
      const lookupSheet = wb.getWorksheet('_LOOKUPS');
      expect(lookupSheet).toBeDefined();
      expect(lookupSheet!.state).toBe('hidden');
      expect(lookupSheet!.getCell('A2').value).toBe('Class 10 - Section A (A)');

      // Sheet 3: _AIOS_SYSTEM_META (Tamper protection)
      const metaSheet = wb.getWorksheet('_AIOS_SYSTEM_META');
      expect(metaSheet).toBeDefined();
      expect(metaSheet!.state).toBe('veryHidden');
      expect(metaSheet!.getCell('B1').value).toBe(instituteId);
      expect(metaSheet!.getCell('B2').value).toBe('STUDENT_ENROLLMENT_V1');
      expect(metaSheet!.getCell('B4').value).toBeDefined(); // HMAC Signature
    });
  });

  describe('validateUpload', () => {
    it('successfully validates a well-formed template containing valid students', async () => {
      // Generate genuine template
      const { buffer } = await service.generateTemplate(instituteId, adminActor);

      // Load and add a valid student
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Student Enrollment')!;

      sheet.addRow([
        'Kabir Mehta',
        'kabir.mehta@apex.edu',
        'C10-01',
        'Class 10 - Section A',
        '2010-01-15',
        'Male',
        'Sunil Mehta',
        '9876500001',
        'sunil@parent.com',
        '12 Park St, Delhi',
        'fast-learner',
      ]);

      const updatedBuffer = Buffer.from(await wb.xlsx.writeBuffer());

      const result = await service.validateUpload(instituteId, updatedBuffer, adminActor);
      expect(result.templateVerified).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.rows[0]?.data.name).toBe('Kabir Mehta');
      expect(result.rows[0]?.data.batchId).toBe('batch-10a');
    });

    it('rejects a template generated for a different institute (cross-tenant upload block)', async () => {
      // Create a fake template with otherInstituteId in metadata
      const wb = new ExcelJS.Workbook();
      const meta = wb.addWorksheet('_AIOS_SYSTEM_META');
      meta.getCell('B1').value = otherInstituteId;
      meta.getCell('B4').value = 'fake-sig';
      const main = wb.addWorksheet('Student Enrollment');
      main.addRow(['Full Name *', 'Email Address *', 'Batch / Class *']);
      main.addRow(['Rohan Gupta', 'rohan@other.edu', 'Class 10']);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());

      await expect(service.validateUpload(instituteId, buffer, adminActor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('detects duplicate emails within the file and against existing institute records', async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ email: 'already.enrolled@apex.edu' }]);

      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Student Enrollment');
      sheet.addRow(['Full Name *', 'Email Address *', 'Roll Number', 'Batch / Class *']);

      // Row 2: Duplicate of existing DB user
      sheet.addRow(['Student One', 'already.enrolled@apex.edu', '101', 'Class 10 - Section A']);
      // Row 3: Unique
      sheet.addRow(['Student Two', 'unique.student@apex.edu', '102', 'Class 10 - Section A']);
      // Row 4: Duplicate of Row 3 within file
      sheet.addRow(['Student Three', 'unique.student@apex.edu', '103', 'Class 10 - Section A']);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.validateUpload(instituteId, buffer, adminActor);

      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);

      const row2 = result.rows.find((r) => r.rowNumber === 2);
      expect(row2?.errors.some((e) => e.includes('already enrolled'))).toBe(true);

      const row4 = result.rows.find((r) => r.rowNumber === 4);
      expect(row4?.errors.some((e) => e.includes('Duplicate email within this file'))).toBe(true);
    });

    it('detects duplicate roll numbers in the same batch', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Student Enrollment');
      sheet.addRow(['Full Name *', 'Email Address *', 'Roll Number', 'Batch / Class *']);

      // Row 2
      sheet.addRow(['Student One', 'stu1@apex.edu', '101', 'Class 10 - Section A']);
      // Row 3: Same roll number in same batch
      sheet.addRow(['Student Two', 'stu2@apex.edu', '101', 'Class 10 - Section A']);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.validateUpload(instituteId, buffer, adminActor);

      const row3 = result.rows.find((r) => r.rowNumber === 3);
      expect(row3?.isValid).toBe(false);
      expect(row3?.errors.some((e) => e.includes("Duplicate roll number '101'"))).toBe(true);
    });

    it('flags unknown batches that do not exist in the institute', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Student Enrollment');
      sheet.addRow(['Full Name *', 'Email Address *', 'Roll Number', 'Batch / Class *']);
      sheet.addRow(['Student One', 'stu1@apex.edu', '101', 'Nonexistent Grade 13']);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.validateUpload(instituteId, buffer, adminActor);

      expect(result.rows[0]?.isValid).toBe(false);
      expect(result.rows[0]?.errors.some((e) => e.includes('was not found'))).toBe(true);
    });
  });

  describe('commitBulkStudents', () => {
    it('enforces institute plan limits before writing any records', async () => {
      entitlements.getLimits.mockResolvedValueOnce({ maxStudents: 20 });
      prisma.studentProfile.count.mockResolvedValueOnce(18); // Only 2 remaining

      const studentsToCommit = [
        { name: 'S1', email: 's1@apex.edu', batchId: 'batch-10a' },
        { name: 'S2', email: 's2@apex.edu', batchId: 'batch-10a' },
        { name: 'S3', email: 's3@apex.edu', batchId: 'batch-10a' }, // 3 students > 2 slots!
      ];

      await expect(
        service.commitBulkStudents(instituteId, studentsToCommit as any, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates User, StudentProfile, and AuditLog in transactional chunks', async () => {
      const studentsToCommit = [
        { name: 'Alice Smith', email: 'alice@apex.edu', rollNumber: '101', batchId: 'batch-10a' },
        { name: 'Bob Jones', email: 'bob@apex.edu', rollNumber: '102', batchId: 'batch-10a' },
      ];

      const result = await service.commitBulkStudents(instituteId, studentsToCommit as any, adminActor);

      expect(result.success).toBe(true);
      expect(result.enrolledCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify User creations
      expect(prisma.user.create).toHaveBeenCalledTimes(2);
      // Verify StudentProfile creations
      expect(prisma.studentProfile.create).toHaveBeenCalledTimes(2);
      // Verify AuditLog
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId,
            actorId: adminActor.id,
            action: AuditAction.CREATE,
            entity: 'student_profiles',
            entityId: 'bulk_enrollment',
          }),
        }),
      );
    });
  });

  describe('generateErrorReportWorkbook', () => {
    it('generates an actionable Excel file highlighting failed rows with error reasons', async () => {
      const failedRows = [
        {
          rowNumber: 4,
          data: { name: 'Faulty Student', email: 'invalid-email', batchName: 'Class 10 - Section A' },
          errors: ['Invalid email format: invalid-email'],
        },
      ];

      const buffer = await service.generateErrorReportWorkbook(instituteId, failedRows);
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Failed Student Records');
      expect(sheet).toBeDefined();

      const row2 = sheet!.getRow(2);
      expect(row2.getCell(1).value).toBe(4);
      expect(row2.getCell(2).value).toContain('Invalid email format');
      expect(row2.getCell(3).value).toBe('Faulty Student');
    });
  });
});
