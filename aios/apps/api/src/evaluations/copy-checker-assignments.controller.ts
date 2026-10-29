import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CopyCheckerAssignmentsService } from './copy-checker-assignments.service';
import { CreateCopyCheckerAssignmentDto } from './dto/copy-checker-assignment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('institutes/:instituteId/deliveries/:deliveryId/copy-checkers')
export class CopyCheckerAssignmentsController {
  constructor(private readonly service: CopyCheckerAssignmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Assign a teacher to an assessment delivery (batch, student list, or question wise)' })
  assign(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: CreateCopyCheckerAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.assign(instituteId, deliveryId, dto, actor);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all evaluator assignments for an assessment delivery' })
  list(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.list(instituteId, deliveryId, actor);
  }

  @Delete(':assignmentId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Revoke an evaluator assignment' })
  remove(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.remove(instituteId, deliveryId, assignmentId, actor);
  }
}
