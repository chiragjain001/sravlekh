import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RubricsService } from './rubrics.service';
import { CreateRubricDto, UpdateRubricDto } from './dto/rubric.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('rubrics')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class RubricsController {
  constructor(private readonly rubricsService: RubricsService) {}

  @Post('questions/:questionId/rubric')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Attach a criterion-additive/step-wise/holistic rubric to a subjective question' })
  createForQuestion(
    @Param('instituteId') instituteId: string,
    @Param('questionId') questionId: string,
    @Body() dto: CreateRubricDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rubricsService.createForQuestion(instituteId, questionId, dto, user);
  }

  @Get('questions/:questionId/rubric')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "Get a question's current rubric (latest version) if one exists" })
  findByQuestion(
    @Param('instituteId') instituteId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rubricsService.findByQuestion(instituteId, questionId, user);
  }

  @Get('rubrics/:rubricId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get a rubric with its full version history' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('rubricId') rubricId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rubricsService.findById(instituteId, rubricId, user);
  }

  @Patch('rubrics/:rubricId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a new rubric version (blocked while a delivery on this question is EVALUATING)' })
  update(
    @Param('instituteId') instituteId: string,
    @Param('rubricId') rubricId: string,
    @Body() dto: UpdateRubricDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rubricsService.update(instituteId, rubricId, dto, user);
  }
}
