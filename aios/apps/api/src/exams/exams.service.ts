import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditAction, UserRole, ExamStatus, PaperStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateExamDto,
  GradeAnswerSheetDto,
} from './dto/exam.dto';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ── D-01: Create Exam ────────────────────────────────────────────────────

  async createExam(instituteId: string, dto: CreateExamDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const blueprint = await this.prisma.blueprint.findUnique({ where: { id: dto.blueprintId } });
    if (!blueprint || blueprint.instituteId !== instituteId) {
      throw new NotFoundException('Blueprint not found');
    }

    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found');
    }

    const exam = await this.prisma.exam.create({
      data: {
        instituteId,
        batchId: dto.batchId,
        blueprintId: dto.blueprintId,
        title: dto.title,
        type: dto.type,
        captureMode: dto.captureMode,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        durationMinutes: dto.durationMinutes ?? blueprint.duration,
        venue: dto.venue,
        createdByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'exams', exam.id, null, { title: exam.title });

    return exam;
  }

  // ── D-01: Link Generated Paper to Exam ───────────────────────────────────

  async linkPaper(instituteId: string, examId: string, paperId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper || paper.instituteId !== instituteId) throw new NotFoundException('Paper not found');

    if (paper.blueprintId !== exam.blueprintId) {
      throw new BadRequestException('Paper blueprint does not match Exam blueprint.');
    }

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { examId, status: PaperStatus.APPROVED },
    });

    return { message: 'Paper linked to Exam successfully.' };
  }

  // ── D-01: Submit Answer Sheet (Manual/OMR) ───────────────────────────────

  async createAnswerSheet(instituteId: string, examId: string, studentProfileId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.instituteId !== instituteId) throw new NotFoundException('Exam not found');

    // Make sure student is in the batch for this exam
    const student = await this.prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
    if (!student || student.batchId !== exam.batchId) {
      throw new BadRequestException('Student does not belong to the exam batch');
    }

    return this.prisma.answerSheet.upsert({
      where: { examId_studentProfileId: { examId, studentProfileId } },
      create: {
        examId,
        studentProfileId,
        captureMode: exam.captureMode,
      },
      update: {},
    });
  }

  // ── D-01: Grade Answer Sheet (Question Level) ────────────────────────────

  async gradeAnswerSheet(
    instituteId: string,
    answerSheetId: string,
    dto: GradeAnswerSheetDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const answerSheet = await this.prisma.answerSheet.findUnique({
      where: { id: answerSheetId },
      include: { exam: true },
    });

    if (!answerSheet || answerSheet.exam.instituteId !== instituteId) {
      throw new NotFoundException('Answer Sheet not found');
    }

    const { examId, studentProfileId } = answerSheet;

    const paper = await this.prisma.paper.findFirst({
      where: { examId, isPersonalized: false },
      include: { items: { include: { question: true } } },
    });

    if (!paper) throw new NotFoundException('No paper associated with this exam.');

    let totalObtained = 0;
    let maxTotal = 0;
    const topicsToRecalculate = new Set<string>();

    await this.prisma.$transaction(async (tx) => {
      for (const response of dto.responses) {
        const item = paper.items.find(pi => pi.questionId === response.questionId);
        if (!item) continue;

        maxTotal += item.marks;
        totalObtained += response.marksAwarded;
        topicsToRecalculate.add(item.question.topicId);

        await tx.response.upsert({
          where: {
            answerSheetId_questionId: {
              answerSheetId,
              questionId: response.questionId,
            }
          },
          create: {
            answerSheetId,
            questionId: response.questionId,
            marksAwarded: response.marksAwarded,
            marksAvailable: item.marks,
            isCorrect: response.isCorrect,
            studentAnswer: response.studentAnswer,
            mistakeTags: response.mistakeTags ?? [],
            teacherComment: response.teacherComment,
          },
          update: {
            marksAwarded: response.marksAwarded,
            isCorrect: response.isCorrect,
            studentAnswer: response.studentAnswer,
            mistakeTags: response.mistakeTags ?? [],
            teacherComment: response.teacherComment,
          },
        });
      }

      // Update Score Record
      const percentage = maxTotal > 0 ? (totalObtained / maxTotal) * 100 : 0;
      await tx.scoreRecord.upsert({
        where: { examId_studentProfileId: { examId, studentProfileId } },
        create: {
          examId,
          studentProfileId,
          totalMarks: maxTotal,
          obtainedMarks: totalObtained,
          percentage,
          evaluatedByUserId: actor.id,
          evaluatedAt: new Date(),
          isFinalized: true,
        },
        update: {
          totalMarks: maxTotal,
          obtainedMarks: totalObtained,
          percentage,
          evaluatedByUserId: actor.id,
          evaluatedAt: new Date(),
          isFinalized: true,
        },
      });

      // Mark answer sheet as verified
      await tx.answerSheet.update({
        where: { id: answerSheetId },
        data: {
          isVerified: true,
          verifiedByUserId: actor.id,
          verifiedAt: new Date(),
        },
      });
    });

    // Fire & Forget: Trigger Analytics Engine (D-02)
    // We run this asynchronously so it doesn't block the HTTP response
    this.analyticsService.recalculateMastery(studentProfileId, Array.from(topicsToRecalculate))
      .catch(err => this.logger.error('Failed async mastery calculation', err));

    return { message: 'Answer sheet graded and finalized. Analytics updated.' };
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
    } catch (err) {}
  }
}
