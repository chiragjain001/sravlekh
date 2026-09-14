import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PapersService } from './papers.service';
import {
  CreateBlueprintDto,
  GeneratePaperDto,
  ManualReplaceItemDto,
  ClonePaperDto,
} from './dto/paper.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { InstituteBulkThrottleGuard } from '../shared/guards/institute-bulk-throttle.guard';

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
  @UseGuards(InstituteBulkThrottleGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Generate a paper based on a blueprint (Paper Engine, rate-limited per institute per hour)' })
  generatePaper(
    @Param('instituteId') instituteId: string,
    @Body() dto: GeneratePaperDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.generatePaper(instituteId, dto, user);
  }

  @Get('papers')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all generated papers for this institute — lightweight (no items/questions), pick one then GET papers/:paperId for detail' })
  findAllPapers(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.findAllPapers(instituteId, user);
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

  @Post('papers/:paperId/clone')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "Copy a paper's current (possibly teacher-edited) items into a new paper for one batch" })
  clonePaper(
    @Param('instituteId') instituteId: string,
    @Param('paperId') paperId: string,
    @Body() dto: ClonePaperDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.clonePaper(instituteId, paperId, dto, user);
  }

  @Post('papers/:paperId/items/:itemId/regenerate')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Reject one item and swap it for a different approved question (same topic/type/difficulty) — DRAFT papers only' })
  regenerateItem(
    @Param('instituteId') instituteId: string,
    @Param('paperId') paperId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.regeneratePaperItem(instituteId, paperId, itemId, user);
  }

  @Patch('papers/:paperId/items/:itemId/manual')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Replace one item with a question the teacher writes themselves — DRAFT papers only' })
  replaceItemManually(
    @Param('instituteId') instituteId: string,
    @Param('paperId') paperId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ManualReplaceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.papersService.replaceItemManually(instituteId, paperId, itemId, dto, user);
  }
}
