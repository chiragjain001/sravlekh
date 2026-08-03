import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * @Roles(...) — marks a route as accessible only to specified roles.
 *
 * Usage:
 *   @Roles(UserRole.ADMIN, UserRole.FOUNDER)
 *   @Get('settings')
 *   getSettings() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
