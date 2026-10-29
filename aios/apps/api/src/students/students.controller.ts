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
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { StudentBulkImportService } from './student-bulk-import.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  TransferBatchDto,
  UpdateTagsDto,
  QueryStudentsDto,
  BulkCommitStudentsDto,
} from './dto/student.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('students')
@ApiBearerAuth()
@Controller('institutes/:instituteId/students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly bulkImportService: StudentBulkImportService,
  ) {}

  // ── Bulk Enrollment Endpoints ──────────────────────────────────────────

  @Get('bulk-template')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Download dynamic Excel enrollment template with live batch dropdowns' })
  async downloadBulkTemplate(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.bulkImportService.generateTemplate(instituteId, user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('bulk-validate')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Admin: Validate uploaded student Excel workbook before commit' })
  async validateBulkUpload(
    @Param('instituteId') instituteId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Please provide a valid Excel file to validate.');
    }
    return this.bulkImportService.validateUpload(instituteId, file.buffer, user);
  }

  @Post('bulk-import')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Commit validated student records to database' })
  async commitBulkImport(
    @Param('instituteId') instituteId: string,
    @Body() dto: BulkCommitStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkImportService.commitBulkStudents(instituteId, dto.students, user);
  }

  @Post('bulk-error-report')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Generate targeted Excel workbook containing only failed rows' })
  async generateErrorReport(
    @Param('instituteId') instituteId: string,
    @Body() payload: { failedRows: Array<{ rowNumber: number; data: any; errors: string[] }> },
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.bulkImportService.generateErrorReportWorkbook(instituteId, payload.failedRows || []);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="AIOS_Failed_Students_Remediation.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // B-01: Create
  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: enrol a new student' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.create(instituteId, dto, user);
  }

  // B-01 + B-02: List with search/filter
  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List students with search/filter and pagination' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.findAll(instituteId, query, user);
  }

  // Real roster aggregates for the Admin overview/analytics screens
  @Get('stats')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Aggregate roster stats (counts by batch/tag/status)' })
  getStats(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.getStats(instituteId, user);
  }

  // Own profile — must be declared before the ':profileId' route below so
  // Nest's route matching doesn't try to resolve 'me' as a profileId.
  @Get('me')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "The logged-in student's own profile, mastery scores, and exam history" })
  findMyProfile(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.findMyProfile(instituteId, user);
  }

  // B-01: Get one
  @Get(':profileId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get a student profile (with history and scores) — a STUDENT may only fetch their own' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.findById(instituteId, profileId, user);
  }

  // B-01: Update (with history)
  @Patch(':profileId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update student profile (writes history)' })
  update(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.update(instituteId, profileId, dto, user);
  }

  // B-01: Batch transfer (with history)
  @Post(':profileId/transfer')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer student to another batch (writes history)' })
  transferBatch(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @Body() dto: TransferBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.transferBatch(instituteId, profileId, dto, user);
  }

  // B-02: Update tags
  @Patch(':profileId/tags')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update student tags' })
  updateTags(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateTagsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.updateTags(instituteId, profileId, dto, user);
  }

  // B-01: Get history
  @Get(':profileId/history')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get full change history for a student profile' })
  getHistory(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.getHistory(instituteId, profileId, user);
  }

  // B-01: Archive
  @Delete(':profileId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a student (soft-delete, preserves all history)' })
  archive(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.archive(instituteId, profileId, user);
  }
}
