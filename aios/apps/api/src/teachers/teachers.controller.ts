import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
  Res, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { TeachersService } from './teachers.service';
import { TeacherBulkImportService } from './teacher-bulk-import.service';
import {
  CreateTeacherDto, UpdateTeacherDto, UpdateMyProfileDto, AssignBatchDto, QueryTeachersDto,
  BulkCommitTeachersDto,
} from './dto/teacher.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('institutes/:instituteId/teachers')
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly bulkImportService: TeacherBulkImportService,
  ) {}

  // ── Bulk Faculty Onboarding Endpoints ──────────────────────────────────

  @Get('bulk-template')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Download dynamic Excel faculty template with live subject dropdowns' })
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
  @ApiOperation({ summary: 'Admin: Validate uploaded teacher Excel workbook before commit' })
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
  @ApiOperation({ summary: 'Admin: Commit validated teacher records to database' })
  async commitBulkImport(
    @Param('instituteId') instituteId: string,
    @Body() dto: BulkCommitTeachersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkImportService.commitBulkTeachers(instituteId, dto.teachers, user);
  }

  @Post('bulk-error-report')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: Generate targeted Excel workbook containing only failed teacher rows' })
  async generateErrorReport(
    @Param('instituteId') instituteId: string,
    @Body() payload: { failedRows: Array<{ rowNumber: number; data: any; errors: string[] }> },
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.bulkImportService.generateErrorReportWorkbook(instituteId, payload.failedRows || []);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="AIOS_Failed_Teachers_Remediation.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: add a new teacher' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.create(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all teachers in an institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryTeachersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.findAll(instituteId, query, user);
  }

  // Real roster aggregates for the Admin overview/analytics screens
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Aggregate roster stats (counts by subject/status/batch-assignment)' })
  getStats(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.getStats(instituteId, user);
  }

  // Registered ahead of the ':profileId' routes below — otherwise Nest would
  // match the literal segment 'me' as a :profileId param instead.
  @Get('me')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher: get my own profile' })
  getMyProfile(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.findMyProfile(instituteId, user);
  }

  @Patch('me')
  @Roles(UserRole.TEACHER)
  @ApiOperation({ summary: 'Teacher: update my own profile (name, qualification)' })
  updateMyProfile(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateMyProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.updateMyProfile(instituteId, dto, user);
  }

  @Get(':profileId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get a teacher profile' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.findById(instituteId, profileId, user);
  }

  @Patch(':profileId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update a teacher profile' })
  update(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.update(instituteId, profileId, dto, user);
  }

  @Post(':profileId/batches')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Assign teacher to a batch' })
  assignToBatch(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @Body() dto: AssignBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.assignToBatch(instituteId, profileId, dto, user);
  }

  @Delete(':profileId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a teacher (soft-delete, preserves all history)' })
  archive(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.archive(instituteId, profileId, user);
  }

  @Delete(':profileId/batches/:batchTeacherId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove teacher from a batch (soft-delete, preserves history)' })
  removeFromBatch(
    @Param('instituteId') instituteId: string,
    @Param('profileId') profileId: string,
    @Param('batchTeacherId') batchTeacherId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teachersService.removeFromBatch(instituteId, profileId, batchTeacherId, user);
  }
}
