import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto } from './dto/attempt.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller('institutes/:instituteId/attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create (and optionally ingest) an attempt via a capture provider — 29-CAPTURE-PROVIDER-ARCHITECTURE.md' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attemptsService.create(instituteId, dto, user);
  }

  @Get(':attemptId/responses')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER, UserRole.STUDENT)
  @ApiOperation({ summary: 'List Responses captured for this attempt' })
  findResponses(
    @Param('instituteId') instituteId: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attemptsService.findResponses(instituteId, attemptId, user);
  }
}
