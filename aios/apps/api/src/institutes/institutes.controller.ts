import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InstitutesService } from './institutes.service';
import {
  CreateInstituteDto,
  UpdateInstituteDto,
  AddAllowListEntryDto,
} from './dto/institute.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('institutes')
@ApiBearerAuth()
@Controller('institutes')
export class InstitutesController {
  constructor(private readonly institutesService: InstitutesService) {}

  // ── Institute CRUD ─────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.FOUNDER)
  @ApiOperation({ summary: 'Founder: create a new institute' })
  create(
    @Body() dto: CreateInstituteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.create(dto, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get institute details' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.findById(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update institute settings' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInstituteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.update(id, dto, user);
  }

  // ── Allow-list management (A-06) ──────────────────────────────────────────

  @Get(':id/allow-list')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all allow-list entries for an institute' })
  getAllowList(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.getAllowList(id, user);
  }

  @Post(':id/allow-list')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Add an email to the institute allow-list' })
  addAllowListEntry(
    @Param('id') id: string,
    @Body() dto: AddAllowListEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.addAllowListEntry(id, dto, user);
  }

  @Delete(':id/allow-list/:entryId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Remove an email from the institute allow-list' })
  removeAllowListEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.removeAllowListEntry(id, entryId, user);
  }
}
