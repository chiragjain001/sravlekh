import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { LeaderboardScope } from './dto/leaderboard.dto';

describe('LeaderboardService — Student vs Teacher scopes and Top Student Cards', () => {
  let service: LeaderboardService;
  let prisma: any;
  let config: any;

  const studentUser: AuthenticatedUser = {
    id: 'user-student-1',
    email: 'student@example.com',
    name: 'Student One',
    role: UserRole.STUDENT,
    instituteId: 'inst-1',
  };

  const teacherUser: AuthenticatedUser = {
    id: 'user-teacher-1',
    email: 'teacher@example.com',
    name: 'Teacher One',
    role: UserRole.TEACHER,
    instituteId: 'inst-1',
  };

  beforeEach(async () => {
    prisma = {
      studentProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      teacherProfile: {
        findUnique: jest.fn(),
      },
      batch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      scoreRecord: {
        findMany: jest.fn(),
      },
      exam: {
        findMany: jest.fn(),
      },
      subject: {
        findMany: jest.fn(),
      },
    };

    config = {
      get: jest.fn((key: string, defaultVal?: any) => defaultVal ?? null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(LeaderboardService);
  });

  describe('assertInstituteAccess', () => {
    it('throws ForbiddenException if actor instituteId does not match', async () => {
      await expect(
        service.getRankLeaderboard('other-inst', {}, studentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRankLeaderboard — Student vs Teacher', () => {
    it('returns student personal standing for Student role', async () => {
      // Mock student profile resolution
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        batchId: 'batch-1',
        batch: { id: 'batch-1', name: 'Section A', classYear: 'Class 11' },
      });

      // Mock class batches
      prisma.batch.findMany.mockResolvedValue([{ id: 'batch-1' }]);

      // Mock students in cohort
      prisma.studentProfile.findMany.mockResolvedValue([
        {
          id: 'sp-1',
          rollNumber: 'R01',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Section A' },
          user: { id: 'user-student-1', name: 'Student One' },
        },
        {
          id: 'sp-2',
          rollNumber: 'R02',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Section A' },
          user: { id: 'user-student-2', name: 'Student Two' },
        },
      ]);

      // Mock score records: sp-2 has 90%, sp-1 has 80%
      prisma.scoreRecord.findMany.mockResolvedValue([
        { studentProfileId: 'sp-2', obtainedMarks: 90, totalMarks: 100, percentage: 90 },
        { studentProfileId: 'sp-1', obtainedMarks: 80, totalMarks: 100, percentage: 80 },
      ]);

      prisma.exam.findMany.mockResolvedValue([]);
      prisma.subject.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Physics', code: 'PHY' }]);

      const result = await service.getRankLeaderboard('inst-1', { scope: LeaderboardScope.CLASS }, studentUser);

      expect(result.scopeLabel).toContain('Class 11');
      // Rankings order: sp-2 rank 1, sp-1 rank 2
      expect(result.rankings[0]?.studentProfileId).toBe('sp-2');
      expect(result.rankings[1]?.studentProfileId).toBe('sp-1');
      // For student, myStanding must be Student One (sp-1) with rank 2
      expect(result.myStanding).toBeDefined();
      expect(result.myStanding?.studentProfileId).toBe('sp-1');
      expect(result.myStanding?.rank).toBe(2);
      expect((result.myStanding as any)?.isTopStudent).toBeUndefined();
    });

    it('returns top student in myStanding for Teacher role and filters to assigned batches/subjects', async () => {
      // Mock teacher profile resolution with assigned batches
      prisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-1',
        subjectIds: ['sub-physics'],
        batchAssignments: [
          {
            batchId: 'batch-1',
            subjectId: 'sub-physics',
            batch: { id: 'batch-1', name: 'Section A', classYear: 'Class 11' },
          },
        ],
      });

      // Mock class batches
      prisma.batch.findMany.mockResolvedValue([
        { id: 'batch-1' },
        { id: 'batch-unassigned' },
      ]);

      // Mock students in cohort
      prisma.studentProfile.findMany.mockResolvedValue([
        {
          id: 'sp-1',
          rollNumber: 'R01',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Section A' },
          user: { id: 'user-student-1', name: 'Student One' },
        },
        {
          id: 'sp-2',
          rollNumber: 'R02',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Section A' },
          user: { id: 'user-student-2', name: 'Top Performer Student' },
        },
      ]);

      // Mock score records: sp-2 has 95% (#1), sp-1 has 75% (#2)
      prisma.scoreRecord.findMany.mockResolvedValue([
        { studentProfileId: 'sp-2', obtainedMarks: 95, totalMarks: 100, percentage: 95 },
        { studentProfileId: 'sp-1', obtainedMarks: 75, totalMarks: 100, percentage: 75 },
      ]);

      prisma.exam.findMany.mockResolvedValue([]);
      prisma.subject.findMany.mockResolvedValue([{ id: 'sub-physics', name: 'Physics', code: 'PHY' }]);

      const result = await service.getRankLeaderboard('inst-1', { scope: LeaderboardScope.BATCH, batchId: 'batch-1' }, teacherUser);

      // Verify that for teacher, myStanding is populated with the TOP student (sp-2)
      expect(result.myStanding).toBeDefined();
      expect(result.myStanding?.studentProfileId).toBe('sp-2');
      expect(result.myStanding?.name).toBe('Top Performer Student');
      expect(result.myStanding?.rank).toBe(1);
      expect((result.myStanding as any)?.isTopStudent).toBe(true);

      // Verify available subjects query was scoped to teacher's subject
      expect(prisma.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['sub-physics'] },
          }),
        }),
      );
    });
  });
});
