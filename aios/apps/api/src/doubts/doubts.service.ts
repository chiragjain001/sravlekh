import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DoubtStatus, AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateDoubtDto,
  AssignDoubtDto,
  ResolveDoubtDto,
  QueryDoubtsDto,
} from './dto/doubt.dto';

@Injectable()
export class DoubtsService {
  private readonly logger = new Logger(DoubtsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── E-01: Create Doubt Ticket (Student) ──────────────────────────────────

  async createDoubt(instituteId: string, studentProfileId: string, dto: CreateDoubtDto, actor: AuthenticatedUser) {
    // Only the student themselves or an admin can create a doubt for this profile
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { user: true },
    });

    if (actor.role === UserRole.STUDENT && student?.userId !== actor.id) {
      throw new ForbiddenException('You can only create doubts for your own profile.');
    }

    if (!student || student.user.instituteId !== instituteId) {
      throw new NotFoundException('Student profile not found');
    }

    const doubt = await this.prisma.doubtTicket.create({
      data: {
        studentProfileId,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        urgency: dto.urgency ?? 1,
        content: dto.content,
        attachmentUrls: dto.attachmentUrls ?? [],
        status: DoubtStatus.OPEN,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'doubtTickets', doubt.id, null, { status: doubt.status });

    return doubt;
  }

  // ── E-02: Query Doubts (Admin/Teacher/Student) ───────────────────────────

  async findAll(instituteId: string, query: QueryDoubtsDto, actor: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      studentProfile: {
        user: { instituteId },
      },
    };

    // RBAC logic
    if (actor.role === UserRole.STUDENT) {
      where.studentProfile = { userId: actor.id };
    } else if (actor.role === UserRole.TEACHER) {
      // Teachers can see doubts assigned to them or unassigned doubts for their subjects
      // For simplicity in this iteration, we allow teachers to see all doubts in the institute 
      // but filterable by subject.
    }

    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.studentProfileId) where.studentProfileId = query.studentProfileId;
    if (query.status) where.status = query.status;

    const [doubts, total] = await Promise.all([
      this.prisma.doubtTicket.findMany({
        where,
        include: {
          studentProfile: { select: { id: true, user: { select: { name: true } } } },
          subject: { select: { name: true } },
          assignedTeacher: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.doubtTicket.count({ where }),
    ]);

    return {
      data: doubts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(instituteId: string, doubtId: string, actor: AuthenticatedUser) {
    const doubt = await this.prisma.doubtTicket.findUnique({
      where: { id: doubtId },
      include: {
        studentProfile: { include: { user: true } },
        subject: true,
        topic: true,
        assignedTeacher: true,
      },
    });

    if (!doubt || doubt.studentProfile.user.instituteId !== instituteId) {
      throw new NotFoundException('Doubt ticket not found');
    }

    if (actor.role === UserRole.STUDENT && doubt.studentProfile.userId !== actor.id) {
      throw new ForbiddenException('You cannot view this doubt.');
    }

    return doubt;
  }

  // ── E-02: Assign Doubt (Admin/Teacher) ───────────────────────────────────

  async assignTeacher(instituteId: string, doubtId: string, dto: AssignDoubtDto, actor: AuthenticatedUser) {
    if (actor.role === UserRole.STUDENT) throw new ForbiddenException('Students cannot assign doubts.');

    const doubt = await this.findById(instituteId, doubtId, actor);

    // Ensure teacher exists and belongs to institute
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherUserId },
    });

    if (!teacher || teacher.instituteId !== instituteId || teacher.role !== UserRole.TEACHER) {
      throw new BadRequestException('Invalid teacher user ID');
    }

    const updated = await this.prisma.doubtTicket.update({
      where: { id: doubtId },
      data: {
        assignedTeacherId: teacher.id,
        status: doubt.status === DoubtStatus.OPEN ? DoubtStatus.ASSIGNED : doubt.status,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'doubtTickets', doubt.id, { assignedTeacherId: doubt.assignedTeacherId }, { assignedTeacherId: teacher.id });

    return updated;
  }

  // ── E-02: Resolve Doubt (Teacher/Admin) ──────────────────────────────────

  async resolveDoubt(instituteId: string, doubtId: string, dto: ResolveDoubtDto, actor: AuthenticatedUser) {
    if (actor.role === UserRole.STUDENT) throw new ForbiddenException('Students cannot resolve doubts.');

    const doubt = await this.findById(instituteId, doubtId, actor);

    const updated = await this.prisma.doubtTicket.update({
      where: { id: doubtId },
      data: {
        status: DoubtStatus.ANSWERED,
        resolvedAt: new Date(),
        responseText: dto.resolutionText,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'doubtTickets', doubt.id, { status: doubt.status }, { status: DoubtStatus.ANSWERED });

    return updated;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

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
