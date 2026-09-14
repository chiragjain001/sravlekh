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
    question: { findMany: jest.Mock; create: jest.Mock };
    paper: { findUnique: jest.Mock };
    paperItem: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'Teacher', role: UserRole.TEACHER, instituteId: 'inst-1' };

  beforeEach(async () => {
    prisma = {
      blueprint: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      question: { findMany: jest.fn(), create: jest.fn() },
      paper: { findUnique: jest.fn() },
      paperItem: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
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

  // ── clonePaper: publishing a reviewed paper to more than one batch ──────
  //
  // Paper.examId is a single scalar — one paper can belong to at most one
  // exam — so linking the SAME reviewed paper to a second batch's exam would
  // silently steal it from the first. clonePaper is how a teacher's reviewed
  // paper reaches N batches: copied item-for-item into a fresh Paper per
  // batch, never re-drawn from the blueprint.

  describe('clonePaper', () => {
    function sourcePaper(overrides: Record<string, unknown> = {}) {
      return {
        id: 'paper-src', instituteId: 'inst-1', blueprintId: 'bp-1', isPersonalized: false,
        items: [
          { questionId: 'q-1', marks: 4, order: 1 },
          { questionId: 'q-2', marks: 4, order: 2 },
        ],
        ...overrides,
      };
    }

    it("copies every item's questionId, marks and order exactly, in one transaction", async () => {
      prisma.paper.findUnique.mockResolvedValueOnce(sourcePaper());
      const createMock = jest.fn().mockResolvedValue({ id: 'paper-clone' });
      const versionMock = jest.fn();
      prisma.$transaction.mockImplementationOnce((fn: any) => fn({ paper: { create: createMock }, paperVersion: { create: versionMock } }));

      const clone = await service.clonePaper('inst-1', 'paper-src', { title: 'Class 10A copy', targetBatchId: 'batch-1' }, admin);

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bp-1',
            title: 'Class 10A copy',
            targetBatchId: 'batch-1',
            items: { createMany: { data: [
              { questionId: 'q-1', marks: 4, order: 1 },
              { questionId: 'q-2', marks: 4, order: 2 },
            ] } },
          }),
        }),
      );
      expect(versionMock).toHaveBeenCalled(); // Set A, same as a freshly generated paper
      expect(clone).toEqual({ id: 'paper-clone' });
    });

    it('refuses to clone a paper with no items — nothing reviewed yet to publish', async () => {
      prisma.paper.findUnique.mockResolvedValueOnce(sourcePaper({ items: [] }));
      await expect(
        service.clonePaper('inst-1', 'paper-src', { title: 'Copy' }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("404s for another institute's paper, not 403 — doesn't confirm the ID exists", async () => {
      prisma.paper.findUnique.mockResolvedValueOnce(sourcePaper({ instituteId: 'inst-OTHER' }));
      await expect(
        service.clonePaper('inst-1', 'paper-src', { title: 'Copy' }, admin),
      ).rejects.toThrow(NotFoundException);
    });

    it('two clones of the same reviewed paper are independent — each gets its own new paper id', async () => {
      prisma.paper.findUnique.mockResolvedValue(sourcePaper());
      prisma.$transaction
        .mockImplementationOnce((fn: any) => fn({ paper: { create: jest.fn().mockResolvedValue({ id: 'paper-clone-A' }) }, paperVersion: { create: jest.fn() } }))
        .mockImplementationOnce((fn: any) => fn({ paper: { create: jest.fn().mockResolvedValue({ id: 'paper-clone-B' }) }, paperVersion: { create: jest.fn() } }));

      const a = await service.clonePaper('inst-1', 'paper-src', { title: 'Batch A', targetBatchId: 'batch-a' }, admin);
      const b = await service.clonePaper('inst-1', 'paper-src', { title: 'Batch B', targetBatchId: 'batch-b' }, admin);

      expect(a.id).not.toBe(b.id);
    });
  });

  // ── Item review: reject a generated question before publishing ──────────
  //
  // Regression coverage for the gap found while manually testing Paper
  // Builder end to end as a teacher: the only place a generated question was
  // ever visible before this was a 5-question decorative sample, and there
  // was no way to reject one — generatePaper() picked the whole paper blind
  // at the final Publish click. These two methods are what a teacher's
  // "reject this question" and "let me write my own" actions call.

  function draftItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'item-1',
      paperId: 'paper-1',
      questionId: 'q-original',
      marks: 4,
      paper: { id: 'paper-1', instituteId: 'inst-1', status: 'DRAFT' },
      question: {
        id: 'q-original',
        subjectId: 'sub-1',
        chapterId: 'ch-1',
        topicId: 't-1',
        type: QuestionType.MCQ,
        difficulty: DifficultyLevel.MEDIUM,
      },
      ...overrides,
    };
  }

  describe('regeneratePaperItem', () => {
    it('swaps to a different approved question matching the same topic/type/difficulty', async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(draftItem());
      prisma.paperItem.findMany.mockResolvedValueOnce([{ questionId: 'q-original' }, { questionId: 'q-sibling' }]);
      prisma.question.findMany.mockResolvedValueOnce([{ id: 'q-replacement' }]);
      prisma.paperItem.update.mockResolvedValueOnce({ id: 'item-1', questionId: 'q-replacement' });

      await service.regeneratePaperItem('inst-1', 'paper-1', 'item-1', admin);

      expect(prisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instituteId: 'inst-1',
            topicId: 't-1',
            type: QuestionType.MCQ,
            difficulty: DifficultyLevel.MEDIUM,
            isApproved: true,
            // Every question already in the paper is excluded, not just the one
            // being replaced — otherwise a swap could duplicate a question that
            // already sits in a different slot of the same paper.
            id: { notIn: ['q-original', 'q-sibling'] },
          }),
        }),
      );
      expect(prisma.paperItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-1' }, data: { questionId: 'q-replacement' } }),
      );
    });

    it('refuses with a clear message when the bank has no other candidate', async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(draftItem());
      prisma.paperItem.findMany.mockResolvedValueOnce([{ questionId: 'q-original' }]);
      prisma.question.findMany.mockResolvedValueOnce([]);

      await expect(service.regeneratePaperItem('inst-1', 'paper-1', 'item-1', admin)).rejects.toThrow(BadRequestException);
      expect(prisma.paperItem.update).not.toHaveBeenCalled();
    });

    it("404s for an item belonging to a different institute's paper", async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(
        draftItem({ paper: { id: 'paper-1', instituteId: 'inst-OTHER', status: 'DRAFT' } }),
      );
      await expect(service.regeneratePaperItem('inst-1', 'paper-1', 'item-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('refuses to edit an item on a paper that is no longer DRAFT — already published to students', async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(
        draftItem({ paper: { id: 'paper-1', instituteId: 'inst-1', status: 'PUBLISHED' } }),
      );
      await expect(service.regeneratePaperItem('inst-1', 'paper-1', 'item-1', admin)).rejects.toThrow(BadRequestException);
      expect(prisma.question.findMany).not.toHaveBeenCalled();
    });
  });

  describe('replaceItemManually', () => {
    it("creates the teacher's question and swaps it into the item, inheriting scope from the original", async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(draftItem());
      prisma.question.create.mockResolvedValueOnce({ id: 'q-manual' });
      prisma.paperItem.update.mockResolvedValueOnce({ id: 'item-1', questionId: 'q-manual' });

      await service.replaceItemManually('inst-1', 'paper-1', 'item-1', { content: 'What is g on the Moon?' }, admin);

      expect(prisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId: 'inst-1',
            subjectId: 'sub-1',
            chapterId: 'ch-1',
            topicId: 't-1',
            type: QuestionType.MCQ,       // inherited — dto didn't override
            difficulty: DifficultyLevel.MEDIUM, // inherited
            marks: 4,                     // inherited from item.marks
            content: 'What is g on the Moon?',
            createdByUserId: 'admin-1',
          }),
        }),
      );
      expect(prisma.paperItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-1' }, data: { questionId: 'q-manual', marks: 4 } }),
      );
    });

    it('an ADMIN authoring a replacement is auto-approved into the bank', async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(draftItem());
      prisma.question.create.mockResolvedValueOnce({ id: 'q-manual' });
      prisma.paperItem.update.mockResolvedValueOnce({});

      await service.replaceItemManually('inst-1', 'paper-1', 'item-1', { content: 'Q' }, admin);

      expect(prisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isApproved: true }) }),
      );
    });

    it('a TEACHER authoring a replacement is NOT auto-approved — mirrors questions.service.ts create()', async () => {
      // The question is still usable in THIS paper regardless (assigned to the
      // item directly, not drawn through the isApproved-only bank query) —
      // isApproved here only gates whether someone else's blueprint can later
      // pick it up too.
      prisma.paperItem.findUnique.mockResolvedValueOnce(draftItem());
      prisma.question.create.mockResolvedValueOnce({ id: 'q-manual' });
      prisma.paperItem.update.mockResolvedValueOnce({});

      await service.replaceItemManually('inst-1', 'paper-1', 'item-1', { content: 'Q' }, teacher);

      expect(prisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isApproved: false, createdByUserId: 'teacher-1' }) }),
      );
      expect(prisma.paperItem.update).toHaveBeenCalled(); // still swapped into the paper
    });

    it('lets the teacher override difficulty and marks explicitly', async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(draftItem());
      prisma.question.create.mockResolvedValueOnce({ id: 'q-manual' });
      prisma.paperItem.update.mockResolvedValueOnce({});

      await service.replaceItemManually(
        'inst-1', 'paper-1', 'item-1',
        { content: 'Harder version', difficulty: DifficultyLevel.HARD, marks: 6 },
        admin,
      );

      expect(prisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ difficulty: DifficultyLevel.HARD, marks: 6 }) }),
      );
      expect(prisma.paperItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { questionId: 'q-manual', marks: 6 } }),
      );
    });

    it('refuses to edit an item on a non-DRAFT paper', async () => {
      prisma.paperItem.findUnique.mockResolvedValueOnce(
        draftItem({ paper: { id: 'paper-1', instituteId: 'inst-1', status: 'PUBLISHED' } }),
      );
      await expect(
        service.replaceItemManually('inst-1', 'paper-1', 'item-1', { content: 'Q' }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.question.create).not.toHaveBeenCalled();
    });
  });
});
