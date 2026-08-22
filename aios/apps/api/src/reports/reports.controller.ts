import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto, QueryReportsDto } from './dto/report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { InstituteBulkThrottleGuard } from '../shared/guards/institute-bulk-throttle.guard';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('institutes/:instituteId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(InstituteBulkThrottleGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Queue a report for generation (rate-limited per institute per hour)' })
  requestReport(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.requestReport(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List reports requested in this institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryReportsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.findAll(instituteId, query, user);
  }

  @Get(':reportId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get a report — poll this until status is COMPLETE for the fileUrl' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.findById(instituteId, reportId, user);
  }
}
