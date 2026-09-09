import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
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

  @Post('batch')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Issue one assignment per enrolled student of a batch, in a single request' })
  createForBatch(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.createAssignmentsForBatch(instituteId, dto, user);
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit an assignment (Students only) — upload a file, or pass a submissionUrl' })
  submitAssignment(
    @Param('instituteId') instituteId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignmentsService.submitAssignment(instituteId, assignmentId, dto, user, file);
  }

  @Get(':assignmentId/submission-url')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "Fresh signed URL for a submission's uploaded file" })
  getSubmissionUrl(
    @Param('instituteId') instituteId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.getSubmissionDownloadUrl(instituteId, assignmentId, user);
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

  @Delete(':assignmentId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Cancel an assignment (removes the per-student rows created with it)' })
  deleteAssignment(
    @Param('instituteId') instituteId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.deleteAssignment(instituteId, assignmentId, user);
  }
}
