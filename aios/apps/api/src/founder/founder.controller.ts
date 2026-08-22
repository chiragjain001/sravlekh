import { Controller, Get, Patch, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FounderService } from './founder.service';
import { AuditService } from '../audit/audit.service';
import { QueryAuditLogsDto } from '../audit/dto/audit-log.dto';
import { UpdateInstitutePlanDto, UpdateFeatureFlagDto, QueryInstitutesDto } from './dto/founder.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('founder')
@ApiBearerAuth()
@Controller('founder')
@Roles(UserRole.FOUNDER)
export class FounderController {
  constructor(
    private readonly founderService: FounderService,
    private readonly auditService: AuditService,
  ) {}

  @Get('institutes')
  @ApiOperation({ summary: 'List every institute on the platform' })
  listInstitutes(@Query() query: QueryInstitutesDto) {
    return this.founderService.listInstitutes(query);
  }

  @Patch('institutes/:id/plan')
  @ApiOperation({ summary: "Change an institute's subscription plan" })
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateInstitutePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.founderService.updatePlan(id, dto, user);
  }

  @Post('institutes/:id/archive')
  @ApiOperation({ summary: 'Archive an institute (soft-delete — never a hard DB delete)' })
  archiveInstitute(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.founderService.archiveInstitute(id, user);
  }

  @Get('health')
  @ApiOperation({ summary: 'Platform health: NestJS/PostgreSQL/FastAPI latency' })
  getHealth() {
    return this.founderService.getHealth();
  }

  @Patch('feature-flags')
  @ApiOperation({ summary: 'Toggle a feature flag for one institute' })
  updateFeatureFlag(@Body() dto: UpdateFeatureFlagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.founderService.updateFeatureFlag(dto, user);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Cross-tenant audit log read, optionally filtered to one institute' })
  findAuditLogs(@Query() query: QueryAuditLogsDto & { instituteId?: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.auditService.findAllGlobal(query, user);
  }
}
