import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus,
  Res, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { sendBinaryDownload } from '../shared/http-response.helper';
import { FastifyFileInterceptor } from '../shared/fastify-file.interceptor';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { BatchesService } from './batches.service';
import { BatchBulkImportService } from './batch-bulk-import.service';
import {
  CreateBatchDto, UpdateBatchDto,
  CreateSubjectDto, CreateChapterDto, CreateTopicDto,
  UpdateSubjectDto, UpdateChapterDto, UpdateTopicDto,
  BulkCommitBatchesDto,
} from './dto/batch.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('batches')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class BatchesController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly bulkImportService: BatchBulkImportService,
  ) {}

  // ── Bulk Batch Setup Endpoints ──────────────────────────────────────────

  @Get('batches/bulk-template')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Download dynamic Excel batch template with live branch & class dropdowns' })
  async downloadBulkTemplate(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: any,
  ) {
    const { buffer, filename } = await this.bulkImportService.generateTemplate(instituteId, user);
    sendBinaryDownload(res, buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    /* res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer); */
  }

  @Post('batches/bulk-validate')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @UseInterceptors(new FastifyFileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Admin: Validate uploaded batch Excel workbook before commit' })
  async validateBulkUpload(
    @Param('instituteId') instituteId: string,
    @UploadedFile() file: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Please provide a valid Excel file to validate.');
    }
    return this.bulkImportService.validateUpload(instituteId, file.buffer, user);
  }

  @Post('batches/bulk-import')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Commit verified batch records into database' })
  async commitBulkBatches(
    @Param('instituteId') instituteId: string,
    @Body() dto: BulkCommitBatchesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkImportService.commitBulkBatches(instituteId, dto.batches, user);
  }

  @Post('batches/bulk-error-report')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Generate downloadable remediation sheet for failed batches' })
  async downloadErrorReport(
    @Param('instituteId') instituteId: string,
    @Body('failedRows') failedRows: any[],
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: any,
  ) {
    const { buffer, filename } = await this.bulkImportService.generateErrorReportWorkbook(
      instituteId,
      failedRows || [],
      user,
    );
    sendBinaryDownload(res, buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    /* res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer); */
  }

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
