import {
  Controller,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import {
  CreateExamDto,
  GradeAnswerSheetDto,
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
