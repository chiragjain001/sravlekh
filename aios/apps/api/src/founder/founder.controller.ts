import { Controller, Get, Patch, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FounderService } from './founder.service';
import { AuditService } from '../audit/audit.service';
import { QueryFounderAuditLogsDto } from '../audit/dto/audit-log.dto';
import { UsersService } from '../users/users.service';
import { QueryGlobalUsersDto } from '../users/dto/query-global-users.dto';
import { SupportTicketsService } from '../support-tickets/support-tickets.service';
import {
  QueryTicketsDto,
  UpdateTicketStatusDto,
  UpdateTicketPriorityDto,
  AssignTicketDto,
  AddTicketMessageDto,
} from '../support-tickets/dto/support-ticket.dto';
import { UpdateInstitutePlanDto, UpdateFeatureFlagDto, QueryInstitutesDto, UpdatePlanDefinitionDto, UpdatePlatformSettingsDto } from './dto/founder.dto';
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
    private readonly usersService: UsersService,
    private readonly ticketsService: SupportTicketsService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Cross-tenant user search — every institute at once' })
  listUsers(@Query() query: QueryGlobalUsersDto) {
    return this.usersService.findAllGlobal(query);
  }

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

  @Get('institutes/:id')
  @ApiOperation({ summary: 'Institute detail: branches, admins, student/teacher counts, allow-list' })
  getInstituteDetail(@Param('id') id: string) {
    return this.founderService.getInstituteDetail(id);
  }

  @Patch('institutes/:id/suspend')
  @ApiOperation({ summary: 'Suspend an institute — blocks all non-Founder access immediately' })
  suspendInstitute(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.founderService.suspendInstitute(id, user);
  }

  @Patch('institutes/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended institute' })
  reactivateInstitute(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.founderService.reactivateInstitute(id, user);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List plan definitions (limits, defaults) for all 4 plan tiers' })
  listPlans() {
    return this.founderService.listPlanDefinitions();
  }

  @Patch('plans/:plan')
  @ApiOperation({ summary: 'Update a plan tier\'s limits/defaults' })
  updatePlanDefinition(
    @Param('plan') plan: string,
    @Body() dto: UpdatePlanDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.founderService.updatePlanDefinition(plan, dto, user);
  }

  @Get('institutes/:id/plan-history')
  @ApiOperation({ summary: 'Plan-change timeline for one institute' })
  getPlanHistory(@Param('id') id: string) {
    return this.founderService.getPlanHistory(id);
  }

  @Get('institutes/:id/usage')
  @ApiOperation({ summary: 'Current usage vs. plan limits for one institute' })
  getUsage(@Param('id') id: string) {
    return this.founderService.getUsage(id);
  }

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Platform-wide analytics: institution growth, active users, assessment/evaluation volume' })
  getAnalyticsOverview() {
    return this.founderService.getAnalyticsOverview();
  }

  @Get('health')
  @ApiOperation({ summary: 'Platform health: NestJS/PostgreSQL/FastAPI/Redis latency' })
  getHealth() {
    return this.founderService.getHealth();
  }

  @Get('health/queues')
  @ApiOperation({ summary: 'Job counts (waiting/active/completed/failed/delayed) for every BullMQ queue' })
  getQueueMetrics() {
    return this.founderService.getQueueMetrics();
  }

  @Get('integrations')
  @ApiOperation({ summary: 'Read-only status per integration — never returns secret values' })
  getIntegrations() {
    return this.founderService.getIntegrations();
  }

  @Patch('feature-flags')
  @ApiOperation({ summary: 'Toggle a feature flag for one institute' })
  updateFeatureFlag(@Body() dto: UpdateFeatureFlagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.founderService.updateFeatureFlag(dto, user);
  }

  @Get('support-tickets')
  @ApiOperation({ summary: 'Cross-tenant support ticket search — every institute at once' })
  listTickets(@Query() query: QueryTicketsDto) {
    return this.ticketsService.findAllGlobal(query);
  }

  @Get('support-tickets/:id')
  @ApiOperation({ summary: 'Ticket detail with full message thread (any institute)' })
  getTicket(@Param('id') id: string) {
    return this.ticketsService.findOneGlobal(id);
  }

  @Patch('support-tickets/:id/status')
  @ApiOperation({ summary: "Change a ticket's status" })
  updateTicketStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.updateStatus(id, dto, user);
  }

  @Patch('support-tickets/:id/priority')
  @ApiOperation({ summary: "Change a ticket's priority" })
  updateTicketPriority(
    @Param('id') id: string,
    @Body() dto: UpdateTicketPriorityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.updatePriority(id, dto, user);
  }

  @Patch('support-tickets/:id/assign')
  @ApiOperation({ summary: 'Assign a ticket to a user' })
  assignTicket(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.assign(id, dto, user);
  }

  @Post('support-tickets/:id/messages')
  @ApiOperation({ summary: 'Reply on a ticket from the Founder console' })
  replyOnTicket(
    @Param('id') id: string,
    @Body() dto: AddTicketMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.addMessageGlobal(id, dto, user);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Read persisted platform-wide toggle settings' })
  getSettings() {
    return this.founderService.getPlatformSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Persist a patch of platform-wide toggle settings' })
  updateSettings(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.founderService.updatePlatformSettings(dto, user);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Cross-tenant audit log read, optionally filtered to one institute' })
  findAuditLogs(@Query() query: QueryFounderAuditLogsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auditService.findAllGlobal(query, user);
  }
}
