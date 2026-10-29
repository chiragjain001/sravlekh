import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole, PrintRunStatus, BookletStatus } from '@prisma/client';
import { BookletsService } from './booklets.service';
import { BookletSecurityService } from './booklet-security.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('BookletsService', () => {
  let service: BookletsService;
  let bookletSecurity: BookletSecurityService;
  let prisma: {
    assessmentDelivery: { findUnique: jest.Mock };
    bookletPrintRun: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    booklet: { findFirst: jest.Mock; createMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const adminActor: AuthenticatedUser = {
    id: 'user-admin',
    email: 'admin@school.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    instituteId: 'inst-1',
  };

  const otherInstituteActor: AuthenticatedUser = {
    ...adminActor,
    id: 'user-other',
    instituteId: 'inst-2',
  };

  beforeEach(async () => {
    prisma = {
      assessmentDelivery: { findUnique: jest.fn() },
      bookletPrintRun: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      booklet: {
        findFirst: jest.fn(),
        createMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookletsService,
        BookletSecurityService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'BOOKLET_QR_SIGNING_KEY') return 'test_secret_for_booklets_key';
              if (key === 'PYTHON_SERVICE_URL') return 'http://127.0.0.1:8000';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<BookletsService>(BookletsService);
    bookletSecurity = module.get<BookletSecurityService>(BookletSecurityService);
  });

  describe('createPrintRun', () => {
    it('rejects cross-institute access', async () => {
      await expect(
        service.createPrintRun('inst-1', 'del-1', { count: 50 }, otherInstituteActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects if assessment delivery does not exist in institute', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createPrintRun('inst-1', 'del-1', { count: 50 }, adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('atomically generates print run and monotonic booklets', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'del-1',
        assessment: {
          instituteId: 'inst-1',
          institute: { id: 'inst-1', name: 'Delhi Public School', shortCode: 'DPS' },
        },
      });

      // No previous booklets -> start at 1
      prisma.booklet.findFirst.mockResolvedValueOnce(null);
      prisma.bookletPrintRun.create.mockResolvedValueOnce({
        id: 'run-1',
        instituteId: 'inst-1',
        assessmentDeliveryId: 'del-1',
        count: 5,
        startSerial: 1,
        endSerial: 5,
        status: PrintRunStatus.READY,
      });

      const res = await service.createPrintRun('inst-1', 'del-1', { count: 5 }, adminActor);
      expect(res.startSerial).toBe(1);
      expect(res.endSerial).toBe(5);
      expect(res.totalCreated).toBe(5);

      expect(prisma.booklet.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            numericSerial: 1,
            bookletSerial: 'BKL-DPS-EL-1-0001',
            status: BookletStatus.GENERATED,
          }),
          expect.objectContaining({
            numericSerial: 5,
            bookletSerial: 'BKL-DPS-EL-1-0005',
            status: BookletStatus.GENERATED,
          }),
        ]),
      });
    });

    it('increments monotonically when existing booklets exist', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'del-1',
        assessment: {
          instituteId: 'inst-1',
          institute: { id: 'inst-1', name: 'DPS', shortCode: 'DPS' },
        },
      });

      // Existing booklet with numericSerial = 50
      prisma.booklet.findFirst.mockResolvedValueOnce({ numericSerial: 50 });
      prisma.bookletPrintRun.create.mockResolvedValueOnce({
        id: 'run-2',
        instituteId: 'inst-1',
        assessmentDeliveryId: 'del-1',
        count: 10,
        startSerial: 51,
        endSerial: 60,
      });

      const res = await service.createPrintRun('inst-1', 'del-1', { count: 10 }, adminActor);
      expect(res.startSerial).toBe(51);
      expect(res.endSerial).toBe(60);
    });
  });

  describe('verifyBookletQr', () => {
    it('verifies valid QR and fetches authoritative database booklet', async () => {
      const { qrString } = bookletSecurity.signBooklet({
        instituteId: 'inst-1',
        deliveryId: 'del-1',
        numericSerial: 1,
        bookletSerial: 'BKL-DPS-DEL1-0001',
      });

      prisma.booklet.findUnique.mockResolvedValueOnce({
        id: 'bkl-1',
        bookletSerial: 'BKL-DPS-DEL1-0001',
        numericSerial: 1,
        status: BookletStatus.GENERATED,
        assessmentDelivery: {
          id: 'del-1',
          assessment: { id: 'asm-1', title: 'Maths Exam', instituteId: 'inst-1' },
          batch: { id: 'batch-1', name: 'Grade 10A' },
        },
      });

      const result = await service.verifyBookletQr('inst-1', qrString);
      expect(result.isValid).toBe(true);
      expect(result.booklet.bookletSerial).toBe('BKL-DPS-DEL1-0001');
      expect(result.delivery.assessmentTitle).toBe('Maths Exam');
    });

    it('rejects QR code with a different institute tenant', async () => {
      const { qrString } = bookletSecurity.signBooklet({
        instituteId: 'inst-999',
        deliveryId: 'del-1',
        numericSerial: 1,
        bookletSerial: 'BKL-DPS-DEL1-0001',
      });

      await expect(service.verifyBookletQr('inst-1', qrString)).rejects.toThrow(ForbiddenException);
    });

    it('rejects VOIDED booklet', async () => {
      const { qrString } = bookletSecurity.signBooklet({
        instituteId: 'inst-1',
        deliveryId: 'del-1',
        numericSerial: 1,
        bookletSerial: 'BKL-DPS-DEL1-0001',
      });

      prisma.booklet.findUnique.mockResolvedValueOnce({
        id: 'bkl-1',
        bookletSerial: 'BKL-DPS-DEL1-0001',
        numericSerial: 1,
        status: BookletStatus.VOIDED,
        voidReason: 'Printer paper jam destroyed cover page',
        assessmentDelivery: {
          id: 'del-1',
          assessment: { id: 'asm-1', title: 'Maths Exam', instituteId: 'inst-1' },
        },
      });

      await expect(service.verifyBookletQr('inst-1', qrString)).rejects.toThrow(BadRequestException);
    });
  });

  describe('voidBooklet', () => {
    it('voids an unused booklet with reason', async () => {
      prisma.booklet.findUnique.mockResolvedValueOnce({
        id: 'bkl-1',
        instituteId: 'inst-1',
        status: BookletStatus.GENERATED,
      });

      prisma.booklet.update.mockResolvedValueOnce({
        id: 'bkl-1',
        status: BookletStatus.VOIDED,
        voidReason: 'Spilled coffee during distribution',
      });

      const res = await service.voidBooklet(
        'inst-1',
        'bkl-1',
        { reason: 'Spilled coffee during distribution' },
        adminActor,
      );

      expect(res.status).toBe(BookletStatus.VOIDED);
      expect(prisma.booklet.update).toHaveBeenCalledWith({
        where: { id: 'bkl-1' },
        data: { status: BookletStatus.VOIDED, voidReason: 'Spilled coffee during distribution' },
      });
    });

    it('refuses to void a booklet already marked SCANNED', async () => {
      prisma.booklet.findUnique.mockResolvedValueOnce({
        id: 'bkl-1',
        instituteId: 'inst-1',
        status: BookletStatus.SCANNED,
      });

      await expect(
        service.voidBooklet('inst-1', 'bkl-1', { reason: 'Misplaced' }, adminActor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
