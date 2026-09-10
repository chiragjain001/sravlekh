import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth.types';

// Gives real teeth to the Founder Settings screen's "Maintenance Mode" toggle
// (previously a local-only checkbox with zero effect — audit-flagged).
// FOUNDER is always exempt so the person who flips this on can always flip it
// back off. Public routes (login, health checks) are exempt so maintenance
// mode never locks out the login screen itself.
//
// The setting is read from the same PlatformSetting row
// FounderService.getPlatformSettings() writes to; cached in-process for a
// few seconds so this guard — which runs on every request — doesn't add a
// database round-trip per request.
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private static cachedValue: boolean | null = null;
  private static cachedAt = 0;
  private static readonly TTL_MS = 5000;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (user?.role === UserRole.FOUNDER) return true;

    const maintenanceOn = await this.isMaintenanceModeOn();
    if (!maintenanceOn) return true;

    throw new ServiceUnavailableException({
      code: 'MAINTENANCE_MODE',
      message: 'AIOS is temporarily down for maintenance. Please try again shortly.',
    });
  }

  private async isMaintenanceModeOn(): Promise<boolean> {
    const now = Date.now();
    if (MaintenanceGuard.cachedValue !== null && now - MaintenanceGuard.cachedAt < MaintenanceGuard.TTL_MS) {
      return MaintenanceGuard.cachedValue;
    }
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'toggles' } });
    const value = Boolean((row?.value as Record<string, boolean> | undefined)?.maintMode);
    MaintenanceGuard.cachedValue = value;
    MaintenanceGuard.cachedAt = now;
    return value;
  }
}
