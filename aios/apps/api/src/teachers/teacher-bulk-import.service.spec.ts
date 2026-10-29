import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole, InstitutePlan, AuditAction } from '@prisma/client';
import { TeacherBulkImportService } from './teacher-bulk-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthenticatedUser } from '../auth/auth.types';
import ExcelJS from 'exceljs';

describe('TeacherBulkImportService — Production Hardening & Tenant Isolation', () => {
  let service: TeacherBulkImportService;
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

  const subjects = [
    { id: 'subj-phy', name: 'Physics', code: 'PHY101' },
    { id: 'subj-math', name: 'Mathematics', code: 'MTH101' },
  ];

  const batches = [
    { id: 'batch-10a', name: 'Class 10 - Section A', section: 'A' },
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
      subject: {
        findMany: jest.fn().mockResolvedValue(subjects),
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
      teacherProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `tp-${Math.random().toString(36).slice(2)}`, ...data }),
        ),
      },
      batchTeacher: {
        create: jest.fn().mockResolvedValue({ id: 'bt-1' }),
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
        maxTeachers: 50,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherBulkImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get<TeacherBulkImportService>(TeacherBulkImportService);
  });

  describe('generateTemplate', () => {
    it('rejects an admin downloading a template for another institute', async () => {
      await expect(
        service.generateTemplate(otherInstituteId, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('generates a valid .xlsx template with active institute subjects, lookup data, and watermark signature', async () => {
      const { buffer, filename } = await service.generateTemplate(instituteId, adminActor);

      expect(filename).toContain('AIOS_Faculty_Onboarding');
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);

      const mainSheet = wb.getWorksheet('Faculty Onboarding');
      expect(mainSheet).toBeDefined();
      expect(mainSheet!.getCell('A1').value).toBe('Full Name *');
      expect(mainSheet!.getCell('B1').value).toBe('Email Address *');
      expect(mainSheet!.getCell('D1').value).toBe('Primary Subject *');

      const lookupSheet = wb.getWorksheet('_LOOKUPS');
      expect(lookupSheet).toBeDefined();
      expect(lookupSheet!.state).toBe('hidden');
      expect(lookupSheet!.getCell('A2').value).toBe('Physics (PHY101)');

      const metaSheet = wb.getWorksheet('_AIOS_SYSTEM_META');
      expect(metaSheet).toBeDefined();
      expect(metaSheet!.state).toBe('veryHidden');
      expect(metaSheet!.getCell('B1').value).toBe(instituteId);
      expect(metaSheet!.getCell('B2').value).toBe('TEACHER_ONBOARDING_V1');
      expect(metaSheet!.getCell('B4').value).toBeDefined(); // HMAC Signature
    });
  });

  describe('validateUpload', () => {
    it('successfully validates a well-formed template containing valid teachers', async () => {
      const { buffer } = await service.generateTemplate(instituteId, adminActor);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Faculty Onboarding')!;

      sheet.addRow([
        'Dr. Alok Verma',
        'alok.verma@apex.edu',
        'Ph.D Physics',
        'Physics',
        'Class 10 - Section A',
      ]);

      const updatedBuffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.validateUpload(instituteId, updatedBuffer, adminActor);

      expect(result.templateVerified).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.rows[0]?.data.name).toBe('Dr. Alok Verma');
      expect(result.rows[0]?.data.subjectId).toBe('subj-phy');
      expect(result.rows[0]?.data.batchId).toBe('batch-10a');
    });

    it('detects duplicate emails within file and against DB', async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ email: 'already.hired@apex.edu' }]);

      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Faculty Onboarding');
      sheet.addRow(['Full Name *', 'Email Address *', 'Qualification', 'Primary Subject *']);

      sheet.addRow(['Teacher One', 'already.hired@apex.edu', 'M.Sc', 'Physics']);
      sheet.addRow(['Teacher Two', 'unique.teacher@apex.edu', 'M.Sc', 'Physics']);
      sheet.addRow(['Teacher Three', 'unique.teacher@apex.edu', 'M.Sc', 'Physics']);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.validateUpload(instituteId, buffer, adminActor);

      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
    });

    it('flags unknown subjects not found in institute', async () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Faculty Onboarding');
      sheet.addRow(['Full Name *', 'Email Address *', 'Qualification', 'Primary Subject *']);
      sheet.addRow(['Teacher One', 't1@apex.edu', 'M.Sc', 'Nonexistent Astronomy']);

      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const result = await service.validateUpload(instituteId, buffer, adminActor);

      expect(result.rows[0]?.isValid).toBe(false);
      expect(result.rows[0]?.errors.some((e) => e.includes('was not found'))).toBe(true);
    });
  });

  describe('commitBulkTeachers', () => {
    it('enforces institute plan limits before writing any records', async () => {
      entitlements.getLimits.mockResolvedValueOnce({ maxTeachers: 5 });
      prisma.teacherProfile.count.mockResolvedValueOnce(4); // 1 remaining

      const teachersToCommit = [
        { name: 'T1', email: 't1@apex.edu', subjectId: 'subj-phy' },
        { name: 'T2', email: 't2@apex.edu', subjectId: 'subj-phy' }, // 2 > 1!
      ];

      await expect(
        service.commitBulkTeachers(instituteId, teachersToCommit as any, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates User, TeacherProfile, BatchTeacher and AuditLog', async () => {
      const teachersToCommit = [
        {
          name: 'Priya Sharma',
          email: 'priya@apex.edu',
          qualification: 'M.Sc',
          subjectId: 'subj-phy',
          batchId: 'batch-10a',
        },
      ];

      const result = await service.commitBulkTeachers(instituteId, teachersToCommit as any, adminActor);

      expect(result.success).toBe(true);
      expect(result.enrolledCount).toBe(1);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(prisma.teacherProfile.create).toHaveBeenCalledTimes(1);
      expect(prisma.batchTeacher.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId,
            actorId: adminActor.id,
            action: AuditAction.CREATE,
            entity: 'teacher_profiles',
          }),
        }),
      );
    });
  });

  describe('generateErrorReportWorkbook', () => {
    it('generates an Excel remediation workbook for failed teachers', async () => {
      const failedRows = [
        {
          rowNumber: 2,
          data: { name: 'Invalid Teacher', email: 'bad-email', subjectName: 'Physics' },
          errors: ['Invalid email format: bad-email'],
        },
      ];

      const buffer = await service.generateErrorReportWorkbook(instituteId, failedRows);
      expect(buffer).toBeInstanceOf(Buffer);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const sheet = wb.getWorksheet('Failed Faculty Records');
      expect(sheet).toBeDefined();
      expect(sheet!.getRow(2).getCell(2).value).toContain('Invalid email format');
    });
  });
});
