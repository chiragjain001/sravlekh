import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole, EvaluationPolicyMode } from '@prisma/client';
import { EvaluationPoliciesService } from './evaluation-policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('EvaluationPoliciesService', () => {
  let service: EvaluationPoliciesService;
  let prisma: {
    evaluationPolicy: { create: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const otherAdmin: AuthenticatedUser = { ...admin, id: 'admin-2', instituteId: 'inst-2' };

  beforeEach(async () => {
    prisma = {
      evaluationPolicy: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluationPoliciesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(EvaluationPoliciesService);
  });

  it('rejects a cross-tenant create', async () => {
    await expect(
      service.create('inst-1', { name: 'x', mode: EvaluationPolicyMode.MANUAL_ONLY }, otherAdmin),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.evaluationPolicy.create).not.toHaveBeenCalled();
  });

  it('defaults requiresHumanReview to true for every mode except AUTOMATIC', async () => {
    prisma.evaluationPolicy.create.mockResolvedValueOnce({ id: 'p1' });
    await service.create('inst-1', { name: 'x', mode: EvaluationPolicyMode.AI_ASSIST_MANDATORY_REVIEW }, admin);
    expect(prisma.evaluationPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requiresHumanReview: true }) }),
    );
  });

  it('defaults requiresHumanReview to false for AUTOMATIC', async () => {
    prisma.evaluationPolicy.create.mockResolvedValueOnce({ id: 'p1' });
    await service.create('inst-1', { name: 'x', mode: EvaluationPolicyMode.AUTOMATIC }, admin);
    expect(prisma.evaluationPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requiresHumanReview: false }) }),
    );
  });

  it('respects an explicit requiresHumanReview override', async () => {
    prisma.evaluationPolicy.create.mockResolvedValueOnce({ id: 'p1' });
    await service.create('inst-1', { name: 'x', mode: EvaluationPolicyMode.AUTOMATIC, requiresHumanReview: true }, admin);
    expect(prisma.evaluationPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requiresHumanReview: true }) }),
    );
  });

  it('scopes findAll by instituteId', async () => {
    prisma.evaluationPolicy.findMany.mockResolvedValueOnce([]);
    await service.findAll('inst-1', admin);
    expect(prisma.evaluationPolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instituteId: 'inst-1' } }),
    );
  });
});
