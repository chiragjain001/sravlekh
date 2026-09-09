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
import { enqueueDeduped, jobKey } from '../infrastructure/queue/enqueue';
import { QUEUE_POLICY } from '../infrastructure/queue/queue-policy';

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
      await enqueueDeduped(this.dispatchQueue, 'dispatch', { noticeId: notice.id }, jobKey('notice', notice.id), { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.noticeDispatch.jobOptions }, this.logger);
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

  // ── Recipient-facing inbox (IN_APP channel) ───────────────────────────────
  // Closes the audit's Critical Risk 08: the broadcast side of this module was
  // always real, but nothing — not even the internal, automated interventions
  // pipeline — could ever be read back by the person it was addressed to.
  // Scoped to the caller's own NoticeDelivery rows; instituteId is still
  // checked via the joined Notice for defense in depth, not because userId
  // alone wouldn't already be tenant-safe.

  async getMyNotifications(instituteId: string, actor: AuthenticatedUser, unreadOnly: boolean) {
    const where = {
      userId: actor.id,
      channel: NoticeChannel.IN_APP,
      notice: { instituteId },
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [deliveries, unreadCount] = await Promise.all([
      this.prisma.noticeDelivery.findMany({
        where,
        include: { notice: { select: { id: true, title: true, body: true, createdByUserId: true, createdAt: true } } },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.prisma.noticeDelivery.count({ where: { userId: actor.id, channel: NoticeChannel.IN_APP, notice: { instituteId }, readAt: null } }),
    ]);

    return { data: deliveries, unreadCount };
  }

  async markNotificationRead(instituteId: string, deliveryId: string, actor: AuthenticatedUser) {
    const delivery = await this.prisma.noticeDelivery.findUnique({
      where: { id: deliveryId },
      include: { notice: { select: { instituteId: true } } },
    });
    if (!delivery || delivery.notice.instituteId !== instituteId || delivery.userId !== actor.id) {
      throw new NotFoundException('Notification not found.');
    }
    if (delivery.readAt) return delivery;
    return this.prisma.noticeDelivery.update({ where: { id: deliveryId }, data: { readAt: new Date() } });
  }

  async markAllNotificationsRead(instituteId: string, actor: AuthenticatedUser) {
    const { count } = await this.prisma.noticeDelivery.updateMany({
      where: { userId: actor.id, channel: NoticeChannel.IN_APP, notice: { instituteId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { markedRead: count };
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

  // ── Withdraw a notice ────────────────────────────────────────────────────

  async deleteNotice(instituteId: string, noticeId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice || notice.instituteId !== instituteId) throw new NotFoundException('Notice not found.');

    // Same ownership rule the delivery report already applies: a teacher owns
    // only what they sent, admins can withdraw anything in their institute.
    if (actor.role === UserRole.TEACHER && notice.createdByUserId !== actor.id) {
      throw new ForbiddenException('You can only withdraw notices you sent.');
    }

    // NoticeDelivery cascades on the FK, so the per-recipient rows go with it.
    await this.prisma.notice.delete({ where: { id: noticeId } });
    await this.writeAudit(instituteId, actor.id, AuditAction.DELETE, 'notices', noticeId, { title: notice.title }, null);

    return { success: true };
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
