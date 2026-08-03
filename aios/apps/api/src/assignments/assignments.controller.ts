import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  SubmitAssignmentDto,
  GradeAssignmentDto,
  QueryAssignmentsDto,
} from './dto/assignment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('institutes/:instituteId/assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a new assignment for a batch or student' })
  createAssignment(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.createAssignment(instituteId, dto, user, false);
  }

  @Post('auto-trigger')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Trigger auto-assignments for students with weak topics' })
  triggerAutoAssignments(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.triggerAutoAssignmentsForWeakTopics(instituteId, user);
  }

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List assignments with filters' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryAssignmentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.findAll(instituteId, query, user);
  }

  @Post(':assignmentId/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit an assignment (Students only)' })
  submitAssignment(
    @Param('instituteId') instituteId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.submitAssignment(instituteId, assignmentId, dto, user);
  }

  @Patch(':assignmentId/grade')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Grade a submitted assignment' })
  gradeAssignment(
    @Param('instituteId') instituteId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: GradeAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.gradeAssignment(instituteId, assignmentId, dto, user);
  }
}
