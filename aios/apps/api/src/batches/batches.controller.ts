import {
  Controller, Get, Post, Patch, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BatchesService } from './batches.service';
import {
  CreateBatchDto, UpdateBatchDto,
  CreateSubjectDto, CreateChapterDto, CreateTopicDto,
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

  @Get('batches/:batchId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get batch details with students and teachers' })
  findBatchById(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.findBatchById(id, batchId, user); }

  @Patch('batches/:batchId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update batch details' })
  updateBatch(
    @Param('instituteId') id: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.updateBatch(id, batchId, dto, user); }

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

  @Post('subjects/:subjectId/chapters')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Add a chapter to a subject' })
  createChapter(
    @Param('instituteId') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateChapterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.createChapter(id, subjectId, dto, user); }

  @Post('chapters/:chapterId/topics')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Add a topic to a chapter' })
  createTopic(
    @Param('instituteId') id: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateTopicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.batchesService.createTopic(id, chapterId, dto, user); }
}
