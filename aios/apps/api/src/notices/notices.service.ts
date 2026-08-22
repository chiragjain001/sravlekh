import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, DeliveryStatus, NoticeChannel, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateNoticeDto, QueryNoticesDto, TargetAudienceDto } from './dto/notice.dto';
import { NOTICE_DISPATCH_QUEUE, NoticeDispatchJobData } from './notice-dispatch.constants';

interface Recipient {
  userId: string;
  email: string;
  guardianPhone: string | null;
}

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTICE_DISPATCH_QUEUE) private readonly dispatchQueue: Queue<NoticeDispatchJobData>,
  ) {}

  // ── Multi-Channel Notice Broadcast (03-FEATURE-SPECIFICATIONS.md) ─────────

  async createNotice(instituteId: string, dto: CreateNoticeDto, actor: AuthenticatedUser) {
    if (actor.role === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot broadcast notices.');
    }
    this.assertInstituteAccess(actor, instituteId);

    const recipients = await this.resolveAudience(instituteId, dto.targetAudience, actor);

    const notice = await this.prisma.notice.create({
      data: {
        instituteId,
        createdByUserId: actor.id,
        title: dto.title,
        body: dto.body,
        channels: dto.channels,
        targetAudience: dto.targetAudience as any,
      },
    });

    const deliveries: {
      noticeId: string;
      userId: string;
      channel: NoticeChannel;
      status: DeliveryStatus;
      failureReason: string | null;
      sentAt: Date | null;
    }[] = [];

    for (const recipient of recipients) {
      for (const channel of dto.channels) {
        if (channel === NoticeChannel.IN_APP) {
          // In-app is a real, working channel — no external provider needed, it's
          // just the delivery row itself that the app's own UI reads.
          deliveries.push({ noticeId: notice.id, userId: recipient.userId, channel, status: DeliveryStatus.SENT, failureReason: null, sentAt: new Date() });
          continue;
        }

        const hasContact =
          channel === NoticeChannel.EMAIL ? Boolean(recipient.email) : Boolean(recipient.guardianPhone);

        if (!hasContact) {
          // 18-EDGE-CASES.md: missing contact info fails that channel only, immediately,
          // without blocking the other channels for this recipient.
          deliveries.push({ noticeId: notice.id, userId: recipient.userId, channel, status: DeliveryStatus.FAILED, failureReason: 'no_contact_info', sentAt: null });
        } else {
          deliveries.push({ noticeId: notice.id, userId: recipient.userId, channel, status: DeliveryStatus.QUEUED, failureReason: null, sentAt: null });
        }
      }
    }

    if (deliveries.length > 0) {
      await this.prisma.noticeDelivery.createMany({ data: deliveries });
    }

    const hasQueued = deliveries.some((d) => d.status === DeliveryStatus.QUEUED);
    if (hasQueued) {
      await this.dispatchQueue.add('dispatch', { noticeId: notice.id }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    }

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'notices', notice.id, null, {
      title: notice.title, recipientCount: recipients.length, channels: dto.channels,
    });

    return { ...notice, recipientCount: recipients.length, deliveryCount: deliveries.length };
  }

  async findAll(instituteId: string, query: QueryNoticesDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { instituteId };
    if (actor.role === UserRole.TEACHER) {
      where.createdByUserId = actor.id;
    }

    const [notices, total] = await Promise.all([
      this.prisma.notice.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { deliveries: true } } },
      }),
      this.prisma.notice.count({ where }),
    ]);

    return { data: notices, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getDeliveryReport(instituteId: string, noticeId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
      include: { deliveries: true },
    });
    if (!notice || notice.instituteId !== instituteId) throw new NotFoundException('Notice not found.');

    if (actor.role === UserRole.TEACHER && notice.createdByUserId !== actor.id) {
      throw new ForbiddenException('You can only view delivery reports for notices you sent.');
    }

    const summary = notice.deliveries.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    }, {});

    return { ...notice, summary };
  }

  // ── Audience resolution ────────────────────────────────────────────────

  private async resolveAudience(
    instituteId: string,
    audience: TargetAudienceDto,
    actor: AuthenticatedUser,
  ): Promise<Recipient[]> {
    let allowedBatchIds: string[] | null = null;

    if (actor.role === UserRole.TEACHER) {
      if (audience.roles && audience.roles.length > 0) {
        throw new ForbiddenException('Teachers can only notify their own batches, not broadcast by role.');
      }
      const teacherProfile = await this.prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
      const assignments = teacherProfile
        ? await this.prisma.batchTeacher.findMany({ where: { teacherProfileId: teacherProfile.id, removedAt: null } })
        : [];
      allowedBatchIds = assignments.map((a) => a.batchId);

      const requestedBatchIds = audience.batchIds ?? [];
      const outOfScope = requestedBatchIds.some((id) => !allowedBatchIds!.includes(id));
      if (outOfScope) {
        throw new ForbiddenException('You can only notify batches you are assigned to.');
      }
    }

    const userIds = new Set<string>();

    if (audience.roles && audience.roles.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { instituteId, role: { in: audience.roles } },
        select: { id: true },
      });
      users.forEach((u) => userIds.add(u.id));
    }

    if (audience.batchIds && audience.batchIds.length > 0) {
      const students = await this.prisma.studentProfile.findMany({
        where: { batchId: { in: audience.batchIds }, user: { instituteId } },
        select: { userId: true },
      });
      students.forEach((s) => userIds.add(s.userId));
    }

    if (audience.studentIds && audience.studentIds.length > 0) {
      const students = await this.prisma.studentProfile.findMany({
        where: { id: { in: audience.studentIds }, user: { instituteId } },
        select: { userId: true, batchId: true },
      });
      if (actor.role === UserRole.TEACHER) {
        const outOfScope = students.some((s) => !s.batchId || !allowedBatchIds!.includes(s.batchId));
        if (outOfScope) {
          throw new ForbiddenException('You can only notify students in batches you are assigned to.');
        }
      }
      students.forEach((s) => userIds.add(s.userId));
    }

    if (userIds.size === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, email: true, studentProfile: { select: { guardianPhone: true } } },
    });

    return users.map((u) => ({
      userId: u.id,
      email: u.email,
      guardianPhone: u.studentProfile?.guardianPhone ?? null,
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
