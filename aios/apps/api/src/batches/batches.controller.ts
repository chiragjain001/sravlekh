import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BatchesService } from './batches.service';
import {
  CreateBatchDto, UpdateBatchDto,
  CreateSubjectDto, CreateChapterDto, CreateTopicDto,
  UpdateSubjectDto, UpdateChapterDto, UpdateTopicDto,
} from './dto/batch.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('batches')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  // ── Batches ───────────────────────────────────────────────────────────────
  @Post('batches')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a new batch' })
  createBatch(
    @Param('instituteId') id: string,
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.createBatch(id, dto, user); }

  @Get('batches')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all batches' })
  findAllBatches(
    @Param('instituteId') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.findAllBatches(id, user); }

  @Get('batches/stats')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Aggregate batch stats (counts by class year, enrollment)' })
  getStats(
    @Param('instituteId') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.getStats(id, user); }

  // Must precede 'batches/:batchId' — otherwise Nest matches this path first
  // and hands "performance-summary" through as a batchId.
  @Get('batches/performance-summary')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Headline performance (studentCount/avgScore/trend) for every visible batch, in one call' })
  getBatchPerformanceSummaries(
    @Param('instituteId') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.getBatchPerformanceSummaries(id, user); }

  @Get('batches/:batchId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get batch details with students and teachers' })
  findBatchById(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.findBatchById(id, batchId, user); }

  @Get('batches/:batchId/performance')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Per-student score aggregation (avg/rank/status) and batch trend' })
  getBatchPerformance(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.getBatchPerformance(id, batchId, user); }

  @Get('batches/:batchId/topics/:topicId/weak-students')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Students in this batch below the mastery threshold for one topic' })
  getWeakStudentsForTopic(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.getWeakStudentsForTopic(id, batchId, topicId, user); }

  @Patch('batches/:batchId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update batch details' })
  updateBatch(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.updateBatch(id, batchId, dto, user); }

  @Delete('batches/:batchId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a batch (soft-delete via isActive, preserves students/history)' })
  archiveBatch(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.archiveBatch(id, batchId, user); }

  // ── Subjects ──────────────────────────────────────────────────────────────
  @Post('subjects')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a subject' })
  createSubject(
    @Param('instituteId') id: string,
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.createSubject(id, dto, user); }

  @Get('subjects')
  @ApiOperation({ summary: 'Get full curriculum (subjects → chapters → topics)' })
  findAllSubjects(
    @Param('instituteId') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.findAllSubjects(id, user); }

  @Patch('subjects/:subjectId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update a subject' })
  updateSubject(
    @Param('instituteId') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.updateSubject(id, subjectId, dto, user); }

  @Delete('subjects/:subjectId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a subject (soft-delete, preserves linked questions/mastery data)' })
  archiveSubject(
    @Param('instituteId') id: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.archiveSubject(id, subjectId, user); }

  @Post('subjects/:subjectId/chapters')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Add a chapter to a subject' })
  createChapter(
    @Param('instituteId') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateChapterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.createChapter(id, subjectId, dto, user); }

  @Patch('chapters/:chapterId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update a chapter' })
  updateChapter(
    @Param('instituteId') id: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.updateChapter(id, chapterId, dto, user); }

  @Delete('chapters/:chapterId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a chapter (soft-delete, preserves linked questions)' })
  archiveChapter(
    @Param('instituteId') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.archiveChapter(id, chapterId, user); }

  @Post('chapters/:chapterId/topics')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Add a topic to a chapter' })
  createTopic(
    @Param('instituteId') id: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateTopicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.createTopic(id, chapterId, dto, user); }

  @Patch('topics/:topicId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update a topic' })
  updateTopic(
    @Param('instituteId') id: string,
    @Param('topicId') topicId: string,
    @Body() dto: UpdateTopicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.updateTopic(id, topicId, dto, user); }

  @Delete('topics/:topicId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a topic (soft-delete, preserves linked questions/mastery data)' })
  archiveTopic(
    @Param('instituteId') id: string,
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.archiveTopic(id, topicId, user); }
}
