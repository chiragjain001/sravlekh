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
import { DoubtsService } from './doubts.service';
import {
  CreateDoubtDto,
  AssignDoubtDto,
  ResolveDoubtDto,
  QueryDoubtsDto,
} from './dto/doubt.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('doubts')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class DoubtsController {
  constructor(private readonly doubtsService: DoubtsService) {}

  @Post('students/:studentProfileId/doubts')
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a doubt ticket for a student' })
  createDoubt(
    @Param('instituteId') instituteId: string,
    @Param('studentProfileId') studentProfileId: string,
    @Body() dto: CreateDoubtDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doubtsService.createDoubt(instituteId, studentProfileId, dto, user);
  }

  @Get('doubts')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List doubt tickets with filters' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryDoubtsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doubtsService.findAll(instituteId, query, user);
  }

  @Get('doubts/:doubtId')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get details of a specific doubt ticket' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('doubtId') doubtId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doubtsService.findById(instituteId, doubtId, user);
  }

  @Patch('doubts/:doubtId/assign')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Assign a doubt to a teacher' })
  assignTeacher(
    @Param('instituteId') instituteId: string,
    @Param('doubtId') doubtId: string,
    @Body() dto: AssignDoubtDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doubtsService.assignTeacher(instituteId, doubtId, dto, user);
  }

  @Post('doubts/:doubtId/resolve')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Resolve a doubt ticket' })
  resolveDoubt(
    @Param('instituteId') instituteId: string,
    @Param('doubtId') doubtId: string,
    @Body() dto: ResolveDoubtDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.doubtsService.resolveDoubt(instituteId, doubtId, dto, user);
  }
}
