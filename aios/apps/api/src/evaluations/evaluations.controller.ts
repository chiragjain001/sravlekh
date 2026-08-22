import { Controller, Get, Post, Body, Param, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { DecideEvaluationDto, OverrideEvaluationDto, QueryEvaluationWorkItemsDto } from './dto/evaluation.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get('evaluation-work-items')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Prioritized queue of subjective Responses needing human evaluation (25 §7)' })
  getWorkItems(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryEvaluationWorkItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationsService.getWorkItems(instituteId, query, user);
  }

  @Post('evaluations/:responseId/decide')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Record a teacher evaluation decision — always creates a new EvaluationVersion, even for ACCEPT_AI (25 §4.2)' })
  decide(
    @Param('instituteId') instituteId: string,
    @Param('responseId') responseId: string,
    @Body() dto: DecideEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationsService.decide(instituteId, responseId, dto, user);
  }

  @Post('evaluations/:responseId/reprocess')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Trigger a fresh AI evaluation pass for one response — chains a new EvaluationVersion(source=AI), never discards prior versions' })
  reprocess(
    @Param('instituteId') instituteId: string,
    @Param('responseId') responseId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationsService.reprocess(instituteId, responseId, idempotencyKey, user);
  }

  @Post('evaluations/:responseId/override')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Reviewer override — requires the REVIEW_EVALUATION permission, not implied by role alone (21 §4.10)' })
  override(
    @Param('instituteId') instituteId: string,
    @Param('responseId') responseId: string,
    @Body() dto: OverrideEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationsService.override(instituteId, responseId, dto, user);
  }

  @Get('evaluations/:responseId/history')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Full ordered EvaluationVersion chain for a response' })
  getHistory(
    @Param('instituteId') instituteId: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationsService.getHistory(instituteId, responseId, user);
  }
}
