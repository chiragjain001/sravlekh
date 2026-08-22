import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EvaluationPoliciesService } from './evaluation-policies.service';
import { CreateEvaluationPolicyDto } from './dto/evaluation-policy.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('evaluation-policies')
@ApiBearerAuth()
@Controller('institutes/:instituteId/evaluation-policies')
export class EvaluationPoliciesController {
  constructor(private readonly evaluationPoliciesService: EvaluationPoliciesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create an evaluation policy (governs how a delivery may be graded)' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateEvaluationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationPoliciesService.create(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List evaluation policies for this institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evaluationPoliciesService.findAll(instituteId, user);
  }
}
