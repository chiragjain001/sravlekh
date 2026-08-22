import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCaptureProviderDto } from './dto/capture-provider.dto';
import { validateCaptureProviderConfig } from './capture-provider-config.validator';

@Injectable()
export class CaptureProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(instituteId: string, dto: CreateCaptureProviderDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    validateCaptureProviderConfig(dto.type, dto.config);

    const provider = await this.prisma.captureProvider.create({
      data: { instituteId, type: dto.type, config: dto.config as any },
    });

    await this.writeAudit(instituteId, actor.id, provider.id, { type: provider.type });

    return provider;
  }

  async findAll(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    return this.prisma.captureProvider.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, entityId: string, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action: AuditAction.CREATE, entity: 'capture_providers', entityId, newValue: newValue as any },
      });
    } catch {
      // audit failures never block the underlying mutation (08-ERROR-HANDLING.md)
    }
  }
}
