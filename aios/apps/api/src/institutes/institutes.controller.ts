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
import { EntitlementsService } from '../entitlements/entitlements.service';

@ApiTags('institutes')
@ApiBearerAuth()
@Controller('institutes')
export class InstitutesController {
  constructor(
    private readonly institutesService: InstitutesService,
    private readonly entitlements: EntitlementsService,
  ) {}

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

  /**
   * An institute's own plan, usage and remaining headroom.
   *
   * The same snapshot the Founder console reads, deliberately exposed to the
   * institute's own ADMIN too: once plan limits actually block writes, the
   * customer needs to see *why* a create was refused and how close they are to
   * the next limit. Tenant-scoped through InstitutesService.findById's existing
   * access check — an ADMIN can only ever read their own institute's usage.
   */
  @Get(':id/entitlements')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Current plan, usage and remaining headroom for an institute' })
  async getEntitlements(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Reuse the existing tenant/role check rather than reimplementing it.
    await this.institutesService.findById(id, user);
    return this.entitlements.getSnapshot(id);
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
