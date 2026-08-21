import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  QueryQuestionsDto,
} from './dto/question.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('questions')
@ApiBearerAuth()
@Controller('institutes/:instituteId/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a new question (version 1)' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.create(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List questions from the bank with filters' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryQuestionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.findAll(instituteId, query, user);
  }

  @Get(':questionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get a question with all its versions' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.findById(instituteId, questionId, user);
  }

  @Patch(':questionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update a question (auto-generates new version if content changes)' })
  update(
    @Param('instituteId') instituteId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.update(instituteId, questionId, dto, user);
  }

  @Post(':questionId/approve')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a question for use in papers' })
  approve(
    @Param('instituteId') instituteId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.approve(instituteId, questionId, user);
  }

  @Delete(':questionId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a question (soft-delete, preserves version/approval history)' })
  archive(
    @Param('instituteId') instituteId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.questionsService.archive(instituteId, questionId, user);
  }
}
