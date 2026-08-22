import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { DecideEvaluationDto, QueryEvaluationWorkItemsDto } from './dto/evaluation.dto';
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
