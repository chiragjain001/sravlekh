import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionGrantDto } from './dto/permission.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('institutes/:instituteId/permission-grants')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Grant a named, optionally-scoped permission to a user (21 §4.10)' })
  grant(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreatePermissionGrantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.grant(instituteId, dto, user);
  }

  @Get('mine')
  @ApiOperation({ summary: "The logged-in user's own permission grants (any role — self-check, not the institute-wide list)" })
  findMyGrants(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.findMyGrants(instituteId, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List permission grants for this institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.findAll(instituteId, user);
  }
}
