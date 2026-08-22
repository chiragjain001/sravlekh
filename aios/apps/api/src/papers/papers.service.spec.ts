import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionType, DifficultyLevel, UserRole } from '@prisma/client';
import { PapersService } from './papers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('PapersService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: PapersService;
  let prisma: {
    blueprint: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    question: { findMany: jest.Mock };
    paper: { findUnique: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };

  beforeEach(async () => {
    prisma = {
      blueprint: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      question: { findMany: jest.fn() },
      paper: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn({
        paper: { create: jest.fn().mockResolvedValue({ id: 'paper-1' }) },
        paperVersion: { create: jest.fn() },
      })),
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PapersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PapersService);
  });

  describe('createBlueprint', () => {
    it('rejects when the distribution marks do not sum to totalMarks', async () => {
      await expect(
        service.createBlueprint('inst-1', {
          subjectId: 'sub-1', name: 'Test', totalMarks: 100, duration: 60,
          distribution: [{ topicId: 't-1', type: QuestionType.MCQ, difficulty: DifficultyLevel.MEDIUM, count: 10, marksPerQuestion: 5 }],
        }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.blueprint.create).not.toHaveBeenCalled();
    });

    it("rejects an admin creating a blueprint under a different institute's ID", async () => {
      await expect(
        service.createBlueprint('inst-OTHER', {
          subjectId: 'sub-1', name: 'Test', totalMarks: 50, duration: 60,
          distribution: [{ topicId: 't-1', type: QuestionType.MCQ, difficulty: DifficultyLevel.MEDIUM, count: 10, marksPerQuestion: 5 }],
        }, admin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generatePaper — cross-institute blueprint guard', () => {
    it("rejects generating a paper from a different institute's blueprint", async () => {
      prisma.blueprint.findUnique.mockResolvedValueOnce({ id: 'bp-1', instituteId: 'inst-OTHER', distribution: [] });
      await expect(
        service.generatePaper('inst-1', { blueprintId: 'bp-1', title: 'Paper' }, admin),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the question bank cannot fill the requested distribution', async () => {
      prisma.blueprint.findUnique.mockResolvedValueOnce({
        id: 'bp-1', instituteId: 'inst-1',
        distribution: [{ topicId: 't-1', type: QuestionType.MCQ, difficulty: DifficultyLevel.MEDIUM, count: 10, marksPerQuestion: 5 }],
      });
      prisma.question.findMany.mockResolvedValueOnce([{ id: 'q-1' }]); // only 1, needs 10

      await expect(
        service.generatePaper('inst-1', { blueprintId: 'bp-1', title: 'Paper' }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('only selects questions scoped to the requesting institute', async () => {
      prisma.blueprint.findUnique.mockResolvedValueOnce({
        id: 'bp-1', instituteId: 'inst-1',
        distribution: [{ topicId: 't-1', type: QuestionType.MCQ, difficulty: DifficultyLevel.MEDIUM, count: 1, marksPerQuestion: 5 }],
      });
      prisma.question.findMany.mockResolvedValueOnce([{ id: 'q-1' }]);

      await service.generatePaper('inst-1', { blueprintId: 'bp-1', title: 'Paper' }, admin);

      expect(prisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ instituteId: 'inst-1' }) }),
      );
    });
  });

  describe('getPaper', () => {
    it("404s (not 403) for a paper belonging to a different institute — doesn't confirm the ID exists", async () => {
      prisma.paper.findUnique.mockResolvedValueOnce({ id: 'paper-1', instituteId: 'inst-OTHER' });
      await expect(service.getPaper('inst-1', 'paper-1', admin)).rejects.toThrow(NotFoundException);
    });
  });
});
