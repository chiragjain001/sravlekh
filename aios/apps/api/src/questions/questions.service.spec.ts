import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('QuestionsService.archive', () => {
  let service: QuestionsService;
  let prisma: { question: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock }; auditLog: { create: jest.Mock } };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      question: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(QuestionsService);
  });

  it('rejects a teacher — only admins may archive', async () => {
    await expect(service.archive('inst-1', 'q-1', teacher)).rejects.toThrow(ForbiddenException);
    expect(prisma.question.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a question belonging to a different institute (tenant isolation)', async () => {
    prisma.question.findUnique.mockResolvedValueOnce({ id: 'q-1', instituteId: 'other-inst', deletedAt: null });
    await expect(service.archive('inst-1', 'q-1', admin)).rejects.toThrow(NotFoundException);
  });

  it('rejects archiving an already-archived question', async () => {
    prisma.question.findUnique.mockResolvedValueOnce({ id: 'q-1', instituteId: 'inst-1', deletedAt: new Date() });
    await expect(service.archive('inst-1', 'q-1', admin)).rejects.toThrow(NotFoundException);
  });

  it('soft-deletes (sets deletedAt) rather than removing the row, and audits it', async () => {
    prisma.question.findUnique.mockResolvedValueOnce({ id: 'q-1', instituteId: 'inst-1', deletedAt: null });
    prisma.question.update.mockResolvedValueOnce({ id: 'q-1', deletedAt: new Date() });

    await service.archive('inst-1', 'q-1', admin);

    expect(prisma.question.update).toHaveBeenCalledWith({
      where: { id: 'q-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('findAll excludes archived questions', async () => {
    prisma.question.findMany.mockResolvedValueOnce([]);
    // count() is also called via Promise.all; stub it on the mock object too.
    (prisma.question as any).count = jest.fn().mockResolvedValueOnce(0);

    await service.findAll('inst-1', {}, admin);

    const call = prisma.question.findMany.mock.calls[0]![0];
    expect(call.where).toMatchObject({ instituteId: 'inst-1', deletedAt: null });
  });
});
