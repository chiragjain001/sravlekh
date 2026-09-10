import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  MarkAttendanceDto, CorrectAttendanceDto, QueryAttendanceDto, QueryAttendanceSummaryDto,
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

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Mark (or re-mark) attendance for a batch on a given date' })
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
  @ApiOperation({ summary: 'Correct a single attendance record after the fact (reason required, audit-logged)' })
  correct(
    @Param('instituteId') instituteId: string,
    @Param('recordId') recordId: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.correctAttendance(instituteId, recordId, dto, user);
  }
}
