import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  QueryInterventionsDto,
  RemedialGroupQueryDto,
  ActionInterventionDto,
  InterventionFilterStatus,
  InterventionActionType,
} from './dto/intervention.dto';
import { getTeacherBatchIds } from '../shared/teacher-scope';

@Injectable()
export class InterventionsService {
  private readonly logger = new Logger(InterventionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List interventions with tenant isolation and teacher batch scoping.
   */
  async listInterventions(instituteId: string, query: QueryInterventionsDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      instituteId,
    };

    if (query.status === InterventionFilterStatus.ACTIVE) {
      where.completedAt = null;
    } else if (query.status === InterventionFilterStatus.COMPLETED) {
      where.completedAt = { not: null };
    }

    if (query.type) {
      where.type = query.type;
    }
    if (query.topicId) {
      where.topicId = query.topicId;
    }
    if (query.studentProfileId) {
      where.studentProfileId = query.studentProfileId;
    }

    if (actor.role === UserRole.TEACHER) {
      const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
      if (teacherBatchIds !== null) {
        if (query.batchId) {
          if (!teacherBatchIds.includes(query.batchId)) {
            throw new ForbiddenException('You do not have access to this batch.');
          }
          where.studentProfile = { batchId: query.batchId };
        } else {
          where.studentProfile = { batchId: { in: teacherBatchIds } };
        }
      }
    } else if (query.batchId) {
      where.studentProfile = { batchId: query.batchId };
    }

    const [items, total] = await Promise.all([
      this.prisma.intervention.findMany({
        where,
        include: {
          studentProfile: {
            select: {
              id: true,
              rollNumber: true,
              batchId: true,
              user: { select: { name: true, email: true } },
            },
          },
          topic: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  id: true,
                  name: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.intervention.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Identifies clusters of students in the same batch needing intervention on the same topic,
   * enabling teachers to organize targeted extra classes instead of isolated manual assignments.
   */
  async getRemedialGroups(instituteId: string, query: RemedialGroupQueryDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    let allowedBatchIds: string[] | null = null;
    if (actor.role === UserRole.TEACHER) {
      allowedBatchIds = await getTeacherBatchIds(this.prisma, actor);
    }

    const targetBatchIds = query.batchId
      ? [query.batchId]
      : allowedBatchIds;

    if (actor.role === UserRole.TEACHER && query.batchId && allowedBatchIds) {
      if (!allowedBatchIds.includes(query.batchId)) {
        throw new ForbiddenException('You do not have access to this batch.');
      }
    }

    const interventions = await this.prisma.intervention.findMany({
      where: {
        instituteId,
        completedAt: null,
        studentProfile: {
          batchId: targetBatchIds ? { in: targetBatchIds } : { not: null },
        },
        ...(query.subjectId
          ? { topic: { chapter: { subjectId: query.subjectId } } }
          : {}),
      },
      include: {
        studentProfile: {
          select: {
            id: true,
            rollNumber: true,
            batchId: true,
            batch: { select: { id: true, name: true } },
            user: { select: { name: true } },
          },
        },
        topic: {
          select: {
            id: true,
            name: true,
            chapter: {
              select: {
                id: true,
                name: true,
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const groupMap = new Map<string, {
      batchId: string;
      batchName: string;
      topicId: string;
      topicName: string;
      subjectName: string;
      students: Array<{
        studentProfileId: string;
        name: string;
        rollNumber: string | null;
        beforeMastery: number | null;
        interventionId: string;
      }>;
    }>();

    for (const item of interventions) {
      const batchId = item.studentProfile.batchId!;
      const batchName = item.studentProfile.batch?.name ?? 'Standard Batch';
      const topicId = item.topicId;
      const topicName = item.topic.name;
      const subjectName = item.topic.chapter.subject.name;

      const groupKey = `${batchId}::${topicId}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          batchId,
          batchName,
          topicId,
          topicName,
          subjectName,
          students: [],
        });
      }

      const group = groupMap.get(groupKey)!;
      // Avoid adding duplicate student records to the same group
      if (!group.students.some((s) => s.studentProfileId === item.studentProfileId)) {
        group.students.push({
          studentProfileId: item.studentProfileId,
          name: item.studentProfile.user.name,
          rollNumber: item.studentProfile.rollNumber,
          beforeMastery: item.beforeMastery,
          interventionId: item.id,
        });
      }
    }

    const remedialGroups = Array.from(groupMap.values()).map((g) => {
      const masteries = g.students.map((s) => s.beforeMastery).filter((m): m is number => m != null);
      const avgMastery = masteries.length
        ? Math.round((masteries.reduce((a, b) => a + b, 0) / masteries.length) * 100) / 100
        : null;

      return {
        batchId: g.batchId,
        batchName: g.batchName,
        topicId: g.topicId,
        topicName: g.topicName,
        subjectName: g.subjectName,
        studentCount: g.students.length,
        averageMastery: avgMastery,
        students: g.students,
        suggestedAction: g.students.length >= 2 ? 'EXTRA_CLASS' : 'TARGETED_PRACTICE',
      };
    });

    // Sort by student count descending (largest learning gaps first)
    return remedialGroups.sort((a, b) => b.studentCount - a.studentCount);
  }

  /**
   * Teacher/Admin reviews, resolves, dismisses, or converts an intervention to an extra class.
   */
  async actionIntervention(
    instituteId: string,
    interventionId: string,
    dto: ActionInterventionDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const intervention = await this.prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        studentProfile: { select: { id: true, batchId: true } },
      },
    });

    if (!intervention || intervention.instituteId !== instituteId) {
      throw new NotFoundException('Intervention not found.');
    }

    if (actor.role === UserRole.TEACHER) {
      const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
      if (
        teacherBatchIds !== null &&
        (!intervention.studentProfile.batchId || !teacherBatchIds.includes(intervention.studentProfile.batchId))
      ) {
        throw new ForbiddenException('You do not have permission to manage interventions for this student.');
      }
    }

    const now = new Date();
    let updated: any;

    if (dto.action === InterventionActionType.CONVERT_TO_EXTRA_CLASS) {
      updated = await this.prisma.intervention.update({
        where: { id: interventionId },
        data: {
          type: 'EXTRA_CLASS',
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          description: dto.note
            ? `${intervention.description ?? ''}\n[Converted to Extra Class]: ${dto.note}`.trim()
            : intervention.description,
        },
      });
    } else if (dto.action === InterventionActionType.RESOLVE) {
      // Find latest mastery score to record post-intervention recovery
      const latestMastery = await this.prisma.masteryScore.findUnique({
        where: {
          studentProfileId_topicId: {
            studentProfileId: intervention.studentProfileId,
            topicId: intervention.topicId,
          },
        },
      });

      updated = await this.prisma.intervention.update({
        where: { id: interventionId },
        data: {
          completedAt: now,
          afterMastery: latestMastery?.masteryValue ?? undefined,
          description: dto.note
            ? `${intervention.description ?? ''}\n[Resolved]: ${dto.note}`.trim()
            : intervention.description,
        },
      });
    } else if (dto.action === InterventionActionType.DISMISS) {
      updated = await this.prisma.intervention.update({
        where: { id: interventionId },
        data: {
          completedAt: now,
          description: dto.note
            ? `${intervention.description ?? ''}\n[Dismissed by Teacher]: ${dto.note}`.trim()
            : `${intervention.description ?? ''}\n[Dismissed by Teacher]`.trim(),
        },
      });
    } else {
      throw new BadRequestException(`Unknown intervention action: ${dto.action}`);
    }

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorId: actor.id,
        action: AuditAction.UPDATE,
        entity: 'interventions',
        entityId: interventionId,
        newValue: { action: dto.action, note: dto.note },
      },
    });

    return updated;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this institute.");
    }
  }
}
