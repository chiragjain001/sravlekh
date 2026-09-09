import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import {
  CreateExamDto,
  GradeAnswerSheetDto,
  UpdateExamStatusDto,
  UnlockExamDto,
} from './dto/exam.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('institutes/:instituteId/exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create an exam (Requires Blueprint and Batch)' })
  createExam(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.createExam(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List exams for this institute — a STUDENT sees only their own batch, published exams onward' })
  findAll(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.findAll(instituteId, user);
  }

  @Get(':examId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get an exam with its batch, blueprint, and linked papers' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.findById(instituteId, examId, user);
  }

  @Get(':examId/results')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Per-student scores and per-question stats for a graded exam' })
  getResults(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.getResults(instituteId, examId, user);
  }

  @Patch(':examId/status')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Move an exam to the next stage (DRAFT -> REVIEW -> APPROVED -> PUBLISHED -> ONGOING -> EVALUATING -> LOCKED)' })
  updateStatus(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @Body() dto: UpdateExamStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.updateStatus(instituteId, examId, dto, user);
  }

  @Delete(':examId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Delete an exam that has not been published yet' })
  deleteExam(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.deleteExam(instituteId, examId, user);
  }

  @Post(':examId/unlock')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: reopen a locked exam for evaluation (reason required, audited)' })
  unlock(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @Body() dto: UnlockExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.unlock(instituteId, examId, dto, user);
  }

  @Post(':examId/link-paper/:paperId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Link a generated paper to an exam' })
  linkPaper(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @Param('paperId') paperId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.linkPaper(instituteId, examId, paperId, user);
  }

  @Post(':examId/answer-sheets/:studentProfileId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create or Initialize an Answer Sheet for a student' })
  createAnswerSheet(
    @Param('instituteId') instituteId: string,
    @Param('examId') examId: string,
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.createAnswerSheet(instituteId, examId, studentProfileId, user);
  }

  @Post('answer-sheets/:answerSheetId/grade')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Grade an Answer Sheet. Triggers Analytics Engine on completion.' })
  gradeAnswerSheet(
    @Param('instituteId') instituteId: string,
    @Param('answerSheetId') answerSheetId: string,
    @Body() dto: GradeAnswerSheetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.examsService.gradeAnswerSheet(instituteId, answerSheetId, dto, user);
  }
}
