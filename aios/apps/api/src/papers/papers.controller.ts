import {
  Controller,
  Get,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PapersService } from './papers.service';
import {
  CreateBlueprintDto,
  GeneratePaperDto,
} from './dto/paper.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('papers')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Post('blueprints')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a syllabus blueprint for exam generation' })
  createBlueprint(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateBlueprintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.createBlueprint(instituteId, dto, user);
  }

  @Get('blueprints')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all blueprints' })
  findAllBlueprints(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.findAllBlueprints(instituteId, user);
  }

  @Post('papers/generate')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Generate a paper based on a blueprint (Paper Engine)' })
  generatePaper(
    @Param('instituteId') instituteId: string,
    @Body() dto: GeneratePaperDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.generatePaper(instituteId, dto, user);
  }

  @Get('papers/:paperId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get a generated paper and its questions' })
  getPaper(
    @Param('instituteId') instituteId: string,
    @Param('paperId') paperId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.getPaper(instituteId, paperId, user);
  }
}
