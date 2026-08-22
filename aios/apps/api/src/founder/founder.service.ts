import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, InstituteStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateInstitutePlanDto, UpdateFeatureFlagDto, QueryInstitutesDto } from './dto/founder.dto';

@Injectable()
export class FounderService {
  private readonly logger = new Logger(FounderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── GET /founder/institutes ─────────────────────────────────────────────

  async listInstitutes(query: QueryInstitutesDto) {
    const where = query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {};
    return this.prisma.institute.findMany({
      where,
      include: { _count: { select: { users: true, batches: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── PATCH /founder/institutes/:id/plan ──────────────────────────────────

  async updatePlan(instituteId: string, dto: UpdateInstitutePlanDto, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    const updated = await this.prisma.institute.update({ where: { id: instituteId }, data: { plan: dto.plan } });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'institutes', instituteId, { plan: institute.plan }, { plan: dto.plan });
    return updated;
  }

  // ── Archive (04-DATABASE-SCHEMA.md: never a hard delete, FOUNDER-only) ──
  // Not in 05-API-SPECIFICATION.md's endpoint list verbatim (that doc only
  // names the plan-patch endpoint) — added as its own explicit, audited action
  // rather than folding it into the plan DTO, since silently allowing an
  // arbitrary status write alongside a plan change is a bigger blast radius
  // than this one specific, well-defined transition.

  async archiveInstitute(instituteId: string, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    const updated = await this.prisma.institute.update({
      where: { id: instituteId },
      data: { status: InstituteStatus.ARCHIVED },
    });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'institutes', instituteId, { status: institute.status }, { status: InstituteStatus.ARCHIVED });
    return updated;
  }

  // ── PATCH /founder/feature-flags ────────────────────────────────────────

  async updateFeatureFlag(dto: UpdateFeatureFlagDto, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: dto.instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    const existingFlags = (institute.featureFlags as Record<string, boolean>) ?? {};
    const nextFlags = { ...existingFlags, [dto.flag]: dto.enabled };

    const updated = await this.prisma.institute.update({
      where: { id: dto.instituteId },
      data: { featureFlags: nextFlags },
    });
    await this.writeAudit(dto.instituteId, actor.id, AuditAction.UPDATE, 'institutes', dto.instituteId, { featureFlags: existingFlags }, { featureFlags: nextFlags });
    return updated;
  }

  // ── GET /founder/health ─────────────────────────────────────────────────

  async getHealth() {
    const nestStart = Date.now();
    const [db, python] = await Promise.all([this.checkDb(), this.checkPython()]);
    return {
      nestjs: { status: 'up', latencyMs: Date.now() - nestStart },
      postgres: db,
      fastapi: python,
    };
  }

  private async checkDb(): Promise<{ status: 'up' | 'down'; latencyMs: number | null }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  private async checkPython(): Promise<{ status: 'up' | 'down'; latencyMs: number | null }> {
    const start = Date.now();
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL') ?? 'http://localhost:8000';
    try {
      await axios.get(`${baseUrl}/health`, { timeout: 3000 });
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
