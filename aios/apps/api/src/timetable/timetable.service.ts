import {
  Injectable,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateTimetableSlotDto,
  QueryTimetableDto,
} from './dto/timetable.dto';

@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── F-02: Create Timetable Slot ──────────────────────────────────────────

  async createSlot(instituteId: string, dto: CreateTimetableSlotDto, actor: AuthenticatedUser) {
    if (actor.role === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot create timetable slots.');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    // 18-EDGE-CASES.md: "Admin schedules a slot that overlaps an existing slot
    // for the same teacher -> 409 conflict, rejected before persistence."
    // Same check applied to roomRef, since the schema/dto carry it for exactly
    // this purpose (03-FEATURE-SPECIFICATIONS.md: "conflict prevention").
    // Recurring-slot occurrence expansion and holiday exceptions are a separate,
    // larger edge case (18-EDGE-CASES.md's holiday-suppresses-one-occurrence rule)
    // and are not covered by this check — it compares the given startTime/endTime
    // window only.
    const overlapping = { startTime: { lt: endTime }, endTime: { gt: startTime } };

    if (dto.teacherUserId) {
      const teacherConflict = await this.prisma.timetableSlot.findFirst({
        where: { instituteId, teacherUserId: dto.teacherUserId, ...overlapping },
      });
      if (teacherConflict) {
        throw new ConflictException({
          code: 'TIMETABLE_TEACHER_CONFLICT',
          message: `This teacher already has "${teacherConflict.title}" scheduled during this time.`,
        });
      }
    }

    if (dto.roomRef) {
      const roomConflict = await this.prisma.timetableSlot.findFirst({
        where: { instituteId, roomRef: dto.roomRef, ...overlapping },
      });
      if (roomConflict) {
        throw new ConflictException({
          code: 'TIMETABLE_ROOM_CONFLICT',
          message: `Room "${dto.roomRef}" is already booked for "${roomConflict.title}" during this time.`,
        });
      }
    }

    const slot = await this.prisma.timetableSlot.create({
      data: {
        instituteId,
        batchId: dto.batchId,
        type: dto.type,
        title: dto.title,
        teacherUserId: dto.teacherUserId,
        subjectId: dto.subjectId,
        roomRef: dto.roomRef,
        startTime,
        endTime,
        isRecurring: dto.isRecurring,
        recurRule: dto.recurRule,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'timetableSlots', slot.id, null, { title: slot.title });

    return slot;
  }

  // ── Query Timetable ──────────────────────────────────────────────────────

  async findAll(instituteId: string, query: QueryTimetableDto, actor: AuthenticatedUser) {
    const where: any = { instituteId };

    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id } });
      if (student) {
        where.batchId = student.batchId;
      }
    } else if (actor.role === UserRole.TEACHER) {
      // Teachers might want to see their own schedule
      if (query.teacherUserId === actor.id) {
        where.teacherUserId = actor.id;
      }
    }

    if (query.batchId) where.batchId = query.batchId;
    if (query.teacherUserId) where.teacherUserId = query.teacherUserId;
    
    if (query.dateStart || query.dateEnd) {
      where.startTime = {};
      if (query.dateStart) where.startTime.gte = new Date(query.dateStart);
      if (query.dateEnd) where.startTime.lte = new Date(query.dateEnd);
    }

    return this.prisma.timetableSlot.findMany({
      where,
      include: {
        batch: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      // Audit-log failures must never block the underlying mutation (08-ERROR-HANDLING.md);
      // still log so a persistent failure is visible rather than silently disappearing.
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
