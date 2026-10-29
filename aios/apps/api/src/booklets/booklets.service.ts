import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookletSecurityService } from './booklet-security.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole, PrintRunStatus, BookletStatus, AuditAction, Prisma } from '@prisma/client';
import { CreatePrintRunDto, VoidBookletDto } from './dto/booklet.dto';
import axios from 'axios';

@Injectable()
export class BookletsService {
  private readonly logger = new Logger(BookletsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bookletSecurity: BookletSecurityService,
  ) { }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Cross-institute access denied.');
    }
  }

  /**
   * Provisions a new BookletPrintRun and atomically creates all serialized Booklet records.
   */
  async createPrintRun(
    instituteId: string,
    deliveryId: string,
    dto: CreatePrintRunDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        assessment: {
          include: {
            institute: { select: { id: true, name: true, shortCode: true } },
          },
        },
      },
    });

    if (!delivery || delivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Assessment delivery not found.');
    }

    const instCode = delivery.assessment.institute.shortCode || 'INST';
    const delSuffix = deliveryId.slice(-4).toUpperCase();
    const count = dto.count;
    const keyId = this.bookletSecurity.getActiveKeyId();

    const result = await this.prisma.$transaction(async (tx) => {
      // Find current highest numeric serial for this delivery to guarantee strictly monotonic increments
      const highestBooklet = await tx.booklet.findFirst({
        where: { assessmentDeliveryId: deliveryId },
        orderBy: { numericSerial: 'desc' },
        select: { numericSerial: true },
      });

      const startSerial = (highestBooklet?.numericSerial ?? 0) + 1;
      const endSerial = startSerial + count - 1;

      const printRun = await tx.bookletPrintRun.create({
        data: {
          instituteId,
          assessmentDeliveryId: deliveryId,
          count,
          startSerial,
          endSerial,
          status: PrintRunStatus.READY,
          signingKeyId: keyId,
          generatedByUserId: actor.id,
        },
      });

      const bookletData: Prisma.BookletCreateManyInput[] = [];
      for (let s = startSerial; s <= endSerial; s++) {
        const serialFormatted = `BKL-${instCode}-${delSuffix}-${String(s).padStart(4, '0')}`;
        bookletData.push({
          instituteId,
          assessmentDeliveryId: deliveryId,
          printRunId: printRun.id,
          bookletSerial: serialFormatted,
          numericSerial: s,
          status: BookletStatus.GENERATED,
        });
      }

      await tx.booklet.createMany({
        data: bookletData,
      });

      return { printRun, startSerial, endSerial, totalCreated: bookletData.length };
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId: actor.id,
          action: AuditAction.CREATE,
          entity: 'booklet_print_runs',
          entityId: result.printRun.id,
          newValue: {
            assessmentDeliveryId: deliveryId,
            count,
            startSerial: result.startSerial,
            endSerial: result.endSerial,
          },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for print run ${result.printRun.id}`, err as Error);
    }

    return result;
  }

  /**
   * Lists all print runs configured for this assessment delivery.
   */
  async getPrintRuns(instituteId: string, deliveryId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    return this.prisma.bookletPrintRun.findMany({
      where: { instituteId, assessmentDeliveryId: deliveryId },
      include: {
        _count: { select: { booklets: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Renders a genuine multi-page PDF containing printable booklet covers for the given print run.
   */
  async renderPrintRunPdf(
    instituteId: string,
    deliveryId: string,
    printRunId: string,
    actor: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string; count: number }> {
    this.assertInstituteAccess(actor, instituteId);

    const printRun = await this.prisma.bookletPrintRun.findUnique({
      where: { id: printRunId },
      include: {
        assessmentDelivery: {
          include: {
            assessment: {
              include: {
                institute: { select: { name: true, shortCode: true } },
                paper: {
                  include: {
                    blueprint: {
                      include: { subject: { select: { name: true } } },
                    },
                  },
                },
              },
            },
            batch: { select: { name: true } },
          },
        },
        booklets: {
          orderBy: { numericSerial: 'asc' },
        },
      },
    });

    if (
      !printRun ||
      printRun.instituteId !== instituteId ||
      printRun.assessmentDeliveryId !== deliveryId
    ) {
      throw new NotFoundException('Booklet print run not found.');
    }

    const delivery = printRun.assessmentDelivery;
    const assessment = delivery.assessment;
    const instituteName = assessment.institute.name || 'SARVLEKH ACADEMY';
    const examTitle = assessment.title || 'EXAMINATION';
    const batchName = delivery.batch?.name || 'Class / Batch';
    const subjectName = assessment.paper?.blueprint?.subject?.name || 'Subject';
    const scheduledDate = delivery.scheduledStart
      ? delivery.scheduledStart.toISOString().slice(0, 10)
      : 'TBD';
    const durationMinutes = assessment.paper?.blueprint?.duration || null;
    const totalMarks = assessment.paper?.blueprint?.totalMarks || null;

    // Generate signed QR payloads for each booklet in this print run
    const coversPayload = printRun.booklets.map((b) => {
      const signed = this.bookletSecurity.signBooklet({
        instituteId,
        deliveryId,
        numericSerial: b.numericSerial,
        bookletSerial: b.bookletSerial,
        keyId: printRun.signingKeyId,
      });

      return {
        bookletSerial: b.bookletSerial,
        qrPayload: signed.qrString,
        examTitle,
        instituteName,
        batchName,
        subjectName,
        scheduledDate,
        durationMinutes,
        totalMarks,
        maxRollDigits: 6,
      };
    });

    const pythonUrl = this.config.get<string>('PYTHON_SERVICE_URL') || 'http://127.0.0.1:8000';
    let pdfBytes: Buffer;
    try {
      const response = await axios.post(
        `${pythonUrl}/booklets/render-covers`,
        { covers: coversPayload },
        {
          responseType: 'arraybuffer',
          timeout: 30000,
        },
      );
      pdfBytes = Buffer.from(response.data);
    } catch (err: any) {
      this.logger.error(
        `Failed to render booklet covers PDF via Python service: ${err.message}`,
        err.stack,
      );
      throw new BadGatewayException(
        'Could not generate printable booklet covers PDF at this time. Please try again shortly.',
      );
    }

    // Mark print run as READY
    await this.prisma.bookletPrintRun.update({
      where: { id: printRunId },
      data: { status: PrintRunStatus.READY },
    });

    return {
      buffer: pdfBytes,
      filename: `booklet-covers-${assessment.title.replace(/[^a-zA-Z0-9_-]/g, '_')}-${printRun.startSerial}-${printRun.endSerial}.pdf`,
      count: printRun.booklets.length,
    };
  }

  /**
   * Verifies an incoming QR payload string cryptographically and validates it against the database.
   */
  async verifyBookletQr(instituteId: string, qrPayload: string, deliveryId?: string) {
    const verified = this.bookletSecurity.verifyBookletQr(qrPayload);
    const { inst, del, bkl, num } = verified.payload;

    if (inst !== instituteId) {
      throw new ForbiddenException('QR code belongs to a different institute tenant.');
    }

    if (deliveryId && del !== deliveryId) {
      throw new BadRequestException('QR code belongs to a different exam delivery (cross-delivery booklet contamination).');
    }

    const booklet = await this.prisma.booklet.findUnique({
      where: {
        assessmentDeliveryId_bookletSerial: {
          assessmentDeliveryId: del,
          bookletSerial: bkl,
        },
      },
      include: {
        assessmentDelivery: {
          include: {
            assessment: { select: { id: true, title: true, instituteId: true } },
            batch: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!booklet) {
      throw new NotFoundException('Booklet record not found in authoritative registry.');
    }

    if (booklet.status === BookletStatus.VOIDED) {
      throw new BadRequestException(
        `This booklet (${bkl}) has been VOIDED. Reason: ${booklet.voidReason || 'Not specified'}. Do not accept or process this sheet.`,
      );
    }

    return {
      isValid: true,
      booklet: {
        id: booklet.id,
        bookletSerial: booklet.bookletSerial,
        numericSerial: booklet.numericSerial,
        status: booklet.status,
      },
      delivery: {
        id: booklet.assessmentDelivery.id,
        assessmentTitle: booklet.assessmentDelivery.assessment.title,
        batchName: booklet.assessmentDelivery.batch?.name,
      },
    };
  }

  /**
   * Marks a damaged, misprinted, or lost booklet as VOIDED.
   */
  async voidBooklet(
    instituteId: string,
    bookletId: string,
    dto: VoidBookletDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const booklet = await this.prisma.booklet.findUnique({
      where: { id: bookletId },
    });

    if (!booklet || booklet.instituteId !== instituteId) {
      throw new NotFoundException('Booklet not found.');
    }

    if (booklet.status === BookletStatus.SCANNED) {
      throw new BadRequestException('Cannot void a booklet that has already been scanned in an examination attempt.');
    }

    const updated = await this.prisma.booklet.update({
      where: { id: bookletId },
      data: {
        status: BookletStatus.VOIDED,
        voidReason: dto.reason,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId: actor.id,
          action: AuditAction.UPDATE,
          entity: 'booklets',
          entityId: bookletId,
          newValue: { status: BookletStatus.VOIDED, reason: dto.reason },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for voiding booklet ${bookletId}`, err as Error);
    }

    return updated;
  }
}
