import { Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto,
  CreateAssessmentDeliveryDto,
  UpdateAssessmentDeliveryStatusDto,
  UnlockAssessmentDeliveryDto,
} from './dto/assessment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('assessments')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post('assessments')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create an assessment (v2-native — 05-API-SPECIFICATION.md V2 section §2)' })
  createAssessment(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.createAssessment(instituteId, dto, user);
  }

  @Get('assessments')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List assessments for this institute' })
  findAllAssessments(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.findAllAssessments(instituteId, user);
  }

  @Get('assessments/:assessmentId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get an assessment with its deliveries' })
  findAssessmentById(
    @Param('instituteId') instituteId: string,
    @Param('assessmentId') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.findAssessmentById(instituteId, assessmentId, user);
  }

  @Post('assessments/:assessmentId/deliveries')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Schedule a delivery of an assessment to a batch' })
  createDelivery(
    @Param('instituteId') instituteId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: CreateAssessmentDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.createDelivery(instituteId, assessmentId, dto, user);
  }

  @Get('assessment-deliveries/:deliveryId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get an assessment delivery' })
  findDeliveryById(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.findDeliveryById(instituteId, deliveryId, user);
  }

  @Patch('assessment-deliveries/:deliveryId/status')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Move a delivery to the next stage — identical state machine to PATCH /exams/:id/status' })
  updateDeliveryStatus(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: UpdateAssessmentDeliveryStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.updateDeliveryStatus(instituteId, deliveryId, dto, user);
  }

  @Post('assessment-deliveries/:deliveryId/unlock')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: reopen a locked delivery for evaluation (reason required, audited)' })
  unlockDelivery(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: UnlockAssessmentDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.unlockDelivery(instituteId, deliveryId, dto, user);
  }
}
