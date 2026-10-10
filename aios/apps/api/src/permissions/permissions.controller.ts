import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  CreatePermissionGrantDto,
  CreateBulkPermissionGrantsDto,
  SyncUserPermissionsDto,
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
  AssignRoleDto,
  SimulateAccessDto,
  RevokeBulkGrantsDto,
} from './dto/permission.dto';
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
  @ApiOperation({ summary: 'Grant a named, optionally-scoped permission to a user' })
  grant(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreatePermissionGrantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.grant(instituteId, dto, user);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Atomically grant multiple permissions to a user' })
  grantBulk(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateBulkPermissionGrantsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.grantBulk(instituteId, dto, user);
  }

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Atomically synchronize/replace a user permissions set (with anti-lockout protection)' })
  syncUserPermissions(
    @Param('instituteId') instituteId: string,
    @Body() dto: SyncUserPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.syncUserPermissions(instituteId, dto, user);
  }

  @Get('mine')
  @ApiOperation({ summary: "The logged-in user's own permission grants (any role — self-check)" })
  findMyGrants(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.findMyGrants(instituteId, user);
  }

  @Get('roles')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List educational role templates, custom roles, and canonical permissions' })
  getRoles(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.getRoles(instituteId, user);
  }

  @Post('roles')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a custom educational role for this institute' })
  createCustomRole(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateCustomRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.createCustomRole(instituteId, dto, user);
  }

  @Put('roles/:roleId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update an existing custom role' })
  updateCustomRole(
    @Param('instituteId') instituteId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateCustomRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.updateCustomRole(instituteId, roleId, dto, user);
  }

  @Delete('roles/:roleId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Delete a custom role (built-in templates protected)' })
  deleteCustomRole(
    @Param('instituteId') instituteId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.deleteCustomRole(instituteId, roleId, user);
  }

  @Post('roles/:roleId/duplicate')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Duplicate an existing role template or custom role' })
  duplicateRole(
    @Param('instituteId') instituteId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.duplicateRole(instituteId, roleId, user);
  }

  @Post('roles/:roleId/assign')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Assign a role template to a user with optional batch/subject scope' })
  assignRole(
    @Param('instituteId') instituteId: string,
    @Param('roleId') roleId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.assignRoleToUser(instituteId, roleId, dto, user);
  }

  @Post('simulate')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Simulate access and impact for a user or proposed permission set' })
  simulateAccess(
    @Param('instituteId') instituteId: string,
    @Body() dto: SimulateAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.simulateAccess(instituteId, dto, user);
  }

  @Get('audit-trail')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Fetch permission and access control change audit log' })
  getAuditTrail(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.getAuditTrail(instituteId, user);
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

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Revoke a permission grant' })
  revoke(
    @Param('instituteId') instituteId: string,
    @Param('id') grantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.revoke(instituteId, grantId, user);
  }

  @Post('revoke-bulk')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Revoke multiple permission grants atomically' })
  revokeBulk(
    @Param('instituteId') instituteId: string,
    @Body() dto: RevokeBulkGrantsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.permissionsService.revokeBulk(instituteId, dto, user);
  }
}
