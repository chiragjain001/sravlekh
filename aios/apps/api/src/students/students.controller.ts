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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  TransferBatchDto,
  UpdateTagsDto,
  QueryStudentsDto,
} from './dto/student.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('students')
@ApiBearerAuth()
@Controller('institutes/:instituteId/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

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
