import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('institutes/:instituteId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get high-level dashboard KPIs' })
  getOverview(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getInstituteOverview(instituteId, user);
  }

  @Get('batch/:batchId/mistake-summary')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get mistake-tag aggregation per topic for a batch' })
  getBatchMistakeSummary(
    @Param('instituteId') instituteId: string,
    @Param('batchId') batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getBatchMistakeSummary(instituteId, batchId, user);
  }
}
