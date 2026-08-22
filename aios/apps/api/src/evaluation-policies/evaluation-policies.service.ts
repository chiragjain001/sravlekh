import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateEvaluationPolicyDto } from './dto/evaluation-policy.dto';

/**
 * 05-API-SPECIFICATION.md (V2 section) §3a: creation alone does not validate
 * against any Assessment — the stakesLevel reconciliation check
 * (EVALUATION_POLICY_STAKES_MISMATCH) happens at delivery-creation time in
 * AssessmentsService, not here.
 */
@Injectable()
export class EvaluationPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(instituteId: string, dto: CreateEvaluationPolicyDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const policy = await this.prisma.evaluationPolicy.create({
      data: {
        instituteId,
        name: dto.name,
        mode: dto.mode,
        requiresHumanReview: dto.requiresHumanReview ?? dto.mode !== 'AUTOMATIC',
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, policy.id, { name: policy.name, mode: policy.mode });

    return policy;
  }

  async findAll(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    return this.prisma.evaluationPolicy.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entityId: string, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity: 'evaluation_policies', entityId, newValue: newValue as any },
      });
    } catch {
      // audit failures never block the underlying mutation (08-ERROR-HANDLING.md)
    }
  }
}
