import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CheckedCopyService } from './checked-copy.service';
import { SubmitCheckedCopyDto } from './dto/checked-copy.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('institutes/:instituteId/attempts/:attemptId/checked-copy')
export class CheckedCopyController {
  constructor(private readonly checkedCopyService: CheckedCopyService) {}

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "One student's answer sheet with every answer's current marks, AI suggestion and tag-wise split" })
  get(
    @Param('instituteId') instituteId: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkedCopyService.get(instituteId, attemptId, user);
  }

  @Post('ai-check')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Queue an AI check for every answer on the sheet that has been read (OCR) but not yet checked' })
  runAiCheck(
    @Param('instituteId') instituteId: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkedCopyService.runAiCheck(instituteId, attemptId, user);
  }

  @Post('submit')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "Approve the whole sheet's marks in one step — writes the student's score and saves the final checked PDF" })
  submit(
    @Param('instituteId') instituteId: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitCheckedCopyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkedCopyService.submit(instituteId, attemptId, dto, user);
  }

  @Post('pdf')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Render the checked copy (DRAFT until submitted, FINAL after) to PDF, store it, and return a short-lived download URL' })
  pdf(
    @Param('instituteId') instituteId: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkedCopyService.getPdf(instituteId, attemptId, user);
  }
}
