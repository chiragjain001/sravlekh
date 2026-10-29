import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole, AssignmentScope } from '@prisma/client';
import { CreateCopyCheckerAssignmentDto } from './dto/copy-checker-assignment.dto';

@Injectable()
export class CopyCheckerAssignmentsService {
  private readonly logger = new Logger(CopyCheckerAssignmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException('Cross-institute access denied.');
    }
  }

  /**
   * Assigns or updates a teacher's evaluation allocation on an assessment delivery.
   */
  async assign(
    instituteId: string,
    deliveryId: string,
    dto: CreateCopyCheckerAssignmentDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    // Verify delivery belongs to tenant
    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: deliveryId },
      include: { assessment: { select: { instituteId: true } } },
    });
    if (!delivery || delivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Assessment delivery not found.');
    }

    // Verify teacher belongs to tenant
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: dto.teacherProfileId },
      include: { user: { select: { instituteId: true, name: true } } },
    });
    if (!teacher || teacher.user.instituteId !== instituteId) {
      throw new NotFoundException('Teacher profile not found.');
    }

    const scope = dto.scope || AssignmentScope.BATCH;

    if (scope === AssignmentScope.STUDENT_LIST && (!dto.studentProfileIds || dto.studentProfileIds.length === 0)) {
      throw new BadRequestException('studentProfileIds required when assignment scope is STUDENT_LIST.');
    }

    if (scope === AssignmentScope.QUESTION_WISE && (!dto.questionIds || dto.questionIds.length === 0)) {
      throw new BadRequestException('questionIds required when assignment scope is QUESTION_WISE.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Upsert the main assignment record
      const assignment = await tx.copyCheckerAssignment.upsert({
        where: {
          assessmentDeliveryId_teacherProfileId: {
            assessmentDeliveryId: deliveryId,
            teacherProfileId: dto.teacherProfileId,
          },
        },
        update: {
          scope,
          isLeadEvaluator: dto.isLeadEvaluator ?? false,
        },
        create: {
          instituteId,
          assessmentDeliveryId: deliveryId,
          teacherProfileId: dto.teacherProfileId,
          scope,
          isLeadEvaluator: dto.isLeadEvaluator ?? false,
        },
      });

      // Handle student list allocations
      if (scope === AssignmentScope.STUDENT_LIST && dto.studentProfileIds) {
        // Enforce: No duplicate student allocation across different evaluators in the same delivery
        const studentConflict = await tx.copyCheckerStudentAllocation.findFirst({
          where: {
            assessmentDeliveryId: deliveryId,
            studentProfileId: { in: dto.studentProfileIds },
            copyCheckerAssignmentId: { not: assignment.id },
          },
          include: { studentProfile: { select: { rollNumber: true, studentCode: true } } },
        });
        if (studentConflict) {
          throw new BadRequestException(
            `Student ${studentConflict.studentProfile?.studentCode || studentConflict.studentProfile?.rollNumber || studentConflict.studentProfileId} is already allocated to another evaluator for this delivery.`,
          );
        }

        await tx.copyCheckerStudentAllocation.deleteMany({
          where: { copyCheckerAssignmentId: assignment.id },
        });

        for (const studentProfileId of dto.studentProfileIds) {
          await tx.copyCheckerStudentAllocation.create({
            data: {
              copyCheckerAssignmentId: assignment.id,
              assessmentDeliveryId: deliveryId,
              studentProfileId,
            },
          });
        }
      }

      // Handle question wise allocations
      if (scope === AssignmentScope.QUESTION_WISE && dto.questionIds) {
        // Enforce: No duplicate question allocation across different evaluators in the same delivery
        const questionConflict = await tx.copyCheckerQuestionAllocation.findFirst({
          where: {
            assessmentDeliveryId: deliveryId,
            questionId: { in: dto.questionIds },
            copyCheckerAssignmentId: { not: assignment.id },
          },
        });
        if (questionConflict) {
          throw new BadRequestException(
            `Question ${questionConflict.questionId} is already allocated to another evaluator for this delivery.`,
          );
        }

        await tx.copyCheckerQuestionAllocation.deleteMany({
          where: { copyCheckerAssignmentId: assignment.id },
        });

        for (const questionId of dto.questionIds) {
          await tx.copyCheckerQuestionAllocation.create({
            data: {
              copyCheckerAssignmentId: assignment.id,
              assessmentDeliveryId: deliveryId,
              questionId,
            },
          });
        }
      }

      return assignment;
    });
  }

  /**
   * Lists all evaluator assignments and specific allocations for a delivery.
   */
  async list(instituteId: string, deliveryId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: deliveryId },
      include: { assessment: { select: { instituteId: true } } },
    });
    if (!delivery || delivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Assessment delivery not found.');
    }

    const assignments = await this.prisma.copyCheckerAssignment.findMany({
      where: { assessmentDeliveryId: deliveryId },
      include: {
        teacherProfile: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        studentAllocations: {
          include: {
            studentProfile: {
              select: {
                id: true,
                rollNumber: true,
                studentCode: true,
                user: { select: { name: true } },
              },
            },
          },
        },
        questionAllocations: {
          include: {
            question: {
              select: { id: true, content: true, marks: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return assignments;
  }

  /**
   * Revokes an evaluator's assignment.
   */
  async remove(instituteId: string, deliveryId: string, assignmentId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const assignment = await this.prisma.copyCheckerAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment || assignment.assessmentDeliveryId !== deliveryId) {
      throw new NotFoundException('Assignment not found.');
    }

    await this.prisma.copyCheckerAssignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Evaluator assignment revoked successfully.' };
  }

  /**
   * Authoritatively checks whether a teacher is permitted to evaluate a specific student or question.
   */
  async assertTeacherAuthorized(params: {
    assessmentDeliveryId: string;
    studentProfileId: string;
    questionId?: string;
    actor: AuthenticatedUser;
    requireWholeSheetAccess?: boolean;
  }) {
    const { assessmentDeliveryId, studentProfileId, questionId, actor, requireWholeSheetAccess } = params;

    // Admins and Founders have full supervisory rights within their institute
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.FOUNDER) {
      return { authorized: true, isLead: true, scope: AssignmentScope.BATCH };
    }

    // Teacher Profile lookup
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: actor.id },
    });
    if (!teacherProfile) {
      throw new ForbiddenException('Teacher profile not found for authenticated actor.');
    }

    // Check delivery-level assignment
    const assignment = await this.prisma.copyCheckerAssignment.findUnique({
      where: {
        assessmentDeliveryId_teacherProfileId: {
          assessmentDeliveryId,
          teacherProfileId: teacherProfile.id,
        },
      },
    });

    // If an explicit delivery assignment exists:
    if (assignment) {
      if (assignment.isLeadEvaluator) {
        return { authorized: true, isLead: true, scope: assignment.scope };
      }

      if (assignment.scope === AssignmentScope.BATCH) {
        return { authorized: true, isLead: false, scope: assignment.scope };
      }

      if (assignment.scope === AssignmentScope.STUDENT_LIST) {
        const studentAlloc = await this.prisma.copyCheckerStudentAllocation.findUnique({
          where: {
            assessmentDeliveryId_studentProfileId: {
              assessmentDeliveryId,
              studentProfileId,
            },
          },
        });
        if (!studentAlloc || studentAlloc.copyCheckerAssignmentId !== assignment.id) {
          throw new ForbiddenException('You are not authorized to evaluate this student\'s answer sheet.');
        }
        return { authorized: true, isLead: false, scope: assignment.scope };
      }

      if (assignment.scope === AssignmentScope.QUESTION_WISE) {
        if (requireWholeSheetAccess) {
          throw new BadRequestException(
            'This assessment is configured for question-wise evaluation. Whole-sheet finalization is restricted to lead evaluators or administrators.',
          );
        }
        if (questionId) {
          const questionAlloc = await this.prisma.copyCheckerQuestionAllocation.findUnique({
            where: {
              assessmentDeliveryId_questionId: {
                assessmentDeliveryId,
                questionId,
              },
            },
          });
          if (!questionAlloc || questionAlloc.copyCheckerAssignmentId !== assignment.id) {
            throw new ForbiddenException('You are not assigned to evaluate this question.');
          }
        }
        return { authorized: true, isLead: false, scope: assignment.scope };
      }
    }

    // Fallback: If no explicit assignment exists, check if teacher teaches this batch
    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: assessmentDeliveryId },
      select: { batchId: true },
    });
    if (delivery) {
      const batchTeacher = await this.prisma.batchTeacher.findFirst({
        where: { batchId: delivery.batchId, teacherProfileId: teacherProfile.id },
      });
      if (batchTeacher) {
        return { authorized: true, isLead: false, scope: AssignmentScope.BATCH };
      }
    }

    throw new ForbiddenException('You are not assigned to evaluate this assessment delivery.');
  }
}
