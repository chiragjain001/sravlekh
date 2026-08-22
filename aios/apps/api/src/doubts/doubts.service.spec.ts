import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DoubtStatus, UserRole } from '@prisma/client';
import { DoubtsService } from './doubts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('DoubtsService.resolveDoubt', () => {
  let service: DoubtsService;
  let prisma: {
    doubtTicket: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'Teacher', role: UserRole.TEACHER, instituteId: 'inst-1' };
  const student: AuthenticatedUser = { id: 'student-1', email: 's@x.com', name: 'Student', role: UserRole.STUDENT, instituteId: 'inst-1' };

  beforeEach(async () => {
    prisma = {
      doubtTicket: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [DoubtsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(DoubtsService);
  });

  function mockDoubt() {
    prisma.doubtTicket.findUnique.mockResolvedValueOnce({
      id: 'doubt-1',
      status: DoubtStatus.ASSIGNED,
      studentProfile: { userId: 'student-1', user: { instituteId: 'inst-1' } },
    });
  }

  it('persists the resolution text (04-DATABASE-SCHEMA.md: responseText is a modeled field)', async () => {
    mockDoubt();
    prisma.doubtTicket.update.mockResolvedValueOnce({ id: 'doubt-1', status: DoubtStatus.ANSWERED });

    await service.resolveDoubt('inst-1', 'doubt-1', { resolutionText: 'Use the quotient rule here.' }, teacher);

    expect(prisma.doubtTicket.update).toHaveBeenCalledWith({
      where: { id: 'doubt-1' },
      data: expect.objectContaining({
        status: DoubtStatus.ANSWERED,
        responseText: 'Use the quotient rule here.',
      }),
    });
  });

  it('rejects a student trying to resolve a doubt', async () => {
    await expect(
      service.resolveDoubt('inst-1', 'doubt-1', { resolutionText: 'nope' }, student),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.doubtTicket.update).not.toHaveBeenCalled();
  });
});
