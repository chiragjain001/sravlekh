import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  SaveAttendanceDraftDto,
  FinalizeAttendanceDto,
  CorrectAttendanceRecordDto,
  CreateTimetableExceptionDto,
  AdminOverrideSessionDto,
  QueryTodaySessionsDto,
  QueryStudentAttendanceDto,
  MarkAttendanceDto,
  CorrectAttendanceDto,
  QueryAttendanceDto,
  QueryAttendanceSummaryDto,
  UpdateAttendancePolicyDto,
} from './dto/attendance.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('institutes/:instituteId/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ── V4 Production Session-First APIs ──────────────────────────────────────

  @Get('today-sessions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "Get today's attendance sessions derived from timetable with snapshot authority" })
  getTodaySessions(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryTodaySessionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getTodaySessions(instituteId, user, query);
  }

  @Get('sessions/:sessionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get session details, student roster, and saved draft/finalized attendance' })
  getSessionDetails(
    @Param('instituteId') instituteId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getSessionDetails(instituteId, sessionId, user);
  }

  @Post('sessions/:sessionId/draft')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Save partial attendance draft with optimistic concurrency control (OCC)' })
  saveDraft(
    @Param('instituteId') instituteId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SaveAttendanceDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.saveDraft(instituteId, sessionId, dto, user);
  }

  @Post('sessions/:sessionId/finalize')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Finalize attendance session, locking records and publishing to students' })
  finalize(
    @Param('instituteId') instituteId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: FinalizeAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.finalizeSession(instituteId, sessionId, dto, user);
  }

  @Patch('sessions/:sessionId/records/:recordId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Correct a finalized attendance record with mandatory reason and immutable audit log' })
  correctRecord(
    @Param('instituteId') instituteId: string,
    @Param('sessionId') sessionId: string,
    @Param('recordId') recordId: string,
    @Body() dto: CorrectAttendanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.correctAttendanceRecord(instituteId, sessionId, recordId, dto, user);
  }

  @Post('exceptions')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create timetable exception (substitute, cancel, reschedule)' })
  createException(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateTimetableExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.createTimetableException(instituteId, dto, user);
  }

  @Post('sessions/:sessionId/override')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin override session state (cancel, uncancel, force unlock)' })
  adminOverride(
    @Param('instituteId') instituteId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: AdminOverrideSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.adminOverrideSession(instituteId, sessionId, dto, user);
  }

  @Get('student')
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Student personal attendance overview, subject breakdown, and history (finalized only)' })
  getStudentAttendance(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryStudentAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getStudentAttendance(instituteId, user, query);
  }

  @Get('missing')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get missing attendance sessions for today' })
  getMissing(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getMissingSessions(instituteId, user);
  }

  @Get('awaiting-finalization')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get sessions that are 100% marked but awaiting teacher finalization' })
  getAwaitingFinalization(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getAwaitingFinalizationSessions(instituteId, user);
  }

  @Post('detect-missing')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Run idempotent missing attendance detection and dispatch alerts' })
  detectMissing(
    @Param('instituteId') instituteId: string,
  ) {
    return this.attendanceService.detectAndAlertMissingSessions(instituteId);
  }

  @Get('policy')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get current institute attendance timing, cutoff and edit policy' })
  getPolicy(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getAttendancePolicy(instituteId, user);
  }

  @Patch('policy')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update institute attendance submission cutoff, windows and permissions' })
  updatePolicy(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateAttendancePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.updateAttendancePolicy(instituteId, dto, user);
  }

  // ── Legacy Compatibility Endpoints ─────────────────────────────────────────

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Legacy: Mark (or re-mark) attendance for a batch on a given date' })
  mark(
    @Param('instituteId') instituteId: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.markAttendance(instituteId, dto, user);
  }

  @Get('summary')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Real per-batch / per-student attendance percentage summary' })
  getSummary(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryAttendanceSummaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getSummary(instituteId, query, user);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List attendance records with batch/student/date-range filters' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.findAll(instituteId, query, user);
  }

  @Patch(':recordId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Correct a single attendance record after the fact' })
  correct(
    @Param('instituteId') instituteId: string,
    @Param('recordId') recordId: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.correctAttendance(instituteId, recordId, dto, user);
  }
}
