import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import { AnalyticsService } from './analytics.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MASTERY_RECALC_QUEUE } from './mastery-recalc.constants';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnalyticsService.requestMasteryRecalc', () => {
  let service: AnalyticsService;
  let configValues: Record<string, string | undefined>;

  async function build() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: getQueueToken(MASTERY_RECALC_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();
    return module.get(AnalyticsService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    configValues = { PYTHON_SERVICE_URL: 'http://localhost:8000' };
    service = await build();
  });

  it('calls the internal Python endpoint, not any hardcoded ai/analytics logic in Node', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await service.requestMasteryRecalc('student-1', ['topic-1', 'topic-2']);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/analytics/recalculate-mastery',
      { studentProfileId: 'student-1', topicIds: ['topic-1', 'topic-2'] },
      expect.objectContaining({ timeout: 15_000 }),
    );
  });

  it('sends the internal service token header when configured', async () => {
    configValues.INTERNAL_SERVICE_TOKEN = 'shared-secret';
    service = await build();
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await service.requestMasteryRecalc('student-1', ['topic-1']);

    const [, , options] = mockedAxios.post.mock.calls[0]!;
    expect((options as { headers?: Record<string, string> }).headers).toEqual({
      'X-Internal-Token': 'shared-secret',
    });
  });

  it('omits the token header when unconfigured (dev-only fallback)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await service.requestMasteryRecalc('student-1', ['topic-1']);

    const [, , options] = mockedAxios.post.mock.calls[0]!;
    expect((options as { headers?: unknown }).headers).toBeUndefined();
  });

  it('rethrows on failure so the BullMQ job retries', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(service.requestMasteryRecalc('student-1', ['topic-1'])).rejects.toThrow('ECONNREFUSED');
  });
});

// 07-SECURITY-SPECIFICATION.md / AGENTS.md §5: instituteId is derived from the
// authenticated actor, never trusted from the request URL. This endpoint took the
// path param straight to Prisma with no ownership check.
describe('AnalyticsService.getInstituteOverview — tenant isolation', () => {
  let service: AnalyticsService;
  let prisma: { user: { count: jest.Mock }; exam: { count: jest.Mock } };

  const actor = (role: UserRole, instituteId: string) =>
    ({ id: 'u-1', role, instituteId }) as AuthenticatedUser;

  beforeEach(async () => {
    prisma = { user: { count: jest.fn().mockResolvedValue(0) }, exam: { count: jest.fn().mockResolvedValue(0) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken(MASTERY_RECALC_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  it('rejects a TEACHER requesting a different institute, without querying', async () => {
    await expect(
      service.getInstituteOverview('inst-other', actor(UserRole.TEACHER, 'inst-mine')),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('rejects an ADMIN requesting a different institute, without querying', async () => {
    await expect(
      service.getInstituteOverview('inst-other', actor(UserRole.ADMIN, 'inst-mine')),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('allows a TEACHER requesting their own institute', async () => {
    await expect(
      service.getInstituteOverview('inst-mine', actor(UserRole.TEACHER, 'inst-mine')),
    ).resolves.toEqual({ totalStudents: 0, totalTeachers: 0, activeExams: 0 });
  });

  it('allows a FOUNDER cross-tenant — its documented, intended scope', async () => {
    await expect(
      service.getInstituteOverview('inst-other', actor(UserRole.FOUNDER, 'inst-mine')),
    ).resolves.toEqual({ totalStudents: 0, totalTeachers: 0, activeExams: 0 });
  });
});

describe('AnalyticsService.getBatchMistakeSummary', () => {
  let service: AnalyticsService;
  let prisma: {
    batch: { findUnique: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
    response: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  const actor = (role: UserRole, instituteId: string, id = 'u-1') =>
    ({ id, role, instituteId }) as AuthenticatedUser;

  beforeEach(async () => {
    prisma = {
      batch: jest.fn().mockResolvedValue({ id: 'batch-1', instituteId: 'inst-1', name: 'Grade 10A' }) as any,
      teacherProfile: jest.fn().mockResolvedValue({ id: 'tp-1' }) as any,
      batchTeacher: jest.fn().mockResolvedValue([{ batchId: 'batch-1' }]) as any,
      response: jest.fn().mockResolvedValue([]) as any,
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    (prisma as any).batch = { findUnique: prisma.batch };
    (prisma as any).teacherProfile = { findUnique: prisma.teacherProfile };
    (prisma as any).batchTeacher = { findMany: prisma.batchTeacher };
    (prisma as any).response = { findMany: prisma.response };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken(MASTERY_RECALC_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  it('rejects cross-tenant requests', async () => {
    await expect(
      service.getBatchMistakeSummary('inst-other', 'batch-1', actor(UserRole.TEACHER, 'inst-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects TEACHER not assigned to batch', async () => {
    prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'other-batch' }]);
    await expect(
      service.getBatchMistakeSummary('inst-1', 'batch-1', actor(UserRole.TEACHER, 'inst-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('aggregates mistake tags by topic and overall for assigned teacher', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { topicId: 'top-1', topicName: 'Quadratic Equations', tag: 'CONCEPT_ERROR', cnt: 2n },
      { topicId: 'top-1', topicName: 'Quadratic Equations', tag: 'CALCULATION_ERROR', cnt: 1n },
      { topicId: 'top-2', topicName: 'Polynomials', tag: 'CARELESS', cnt: 1n },
    ]);

    const result = await service.getBatchMistakeSummary('inst-1', 'batch-1', actor(UserRole.TEACHER, 'inst-1'));

    expect(result.batchId).toBe('batch-1');
    expect(result.totalMistakes).toBe(4);
    expect(result.byTag).toEqual({
      CONCEPT_ERROR: 2,
      CALCULATION_ERROR: 1,
      CARELESS: 1,
    });
    expect(result.byTopic).toHaveLength(2);
    expect(result.byTopic[0]).toEqual({
      topicId: 'top-1',
      topicName: 'Quadratic Equations',
      totalMistakes: 3,
      byTag: { CONCEPT_ERROR: 2, CALCULATION_ERROR: 1 },
    });
    expect(result.byTopic[1]).toEqual({
      topicId: 'top-2',
      topicName: 'Polynomials',
      totalMistakes: 1,
      byTag: { CARELESS: 1 },
    });
  });

  it('correctly aggregates UNTAGGED errors and tracks marksLost when present', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { topicId: 'top-1', topicName: 'Kinematics', tag: 'CONCEPT_ERROR', cnt: 2n, marksLost: 4.5 },
      { topicId: 'top-1', topicName: 'Kinematics', tag: 'UNTAGGED', cnt: 1n, marksLost: 2.0 },
      { topicId: 'top-2', topicName: 'Dynamics', tag: 'CALCULATION_ERROR', cnt: 1n, marksLost: 1.0 },
    ]);

    const result = await service.getBatchMistakeSummary('inst-1', 'batch-1', actor(UserRole.TEACHER, 'inst-1'));

    expect(result.totalMistakes).toBe(4);
    expect(result.totalMarksLost).toBe(7.5);
    expect(result.byTag.UNTAGGED).toBe(1);
    expect(result.byTopic[0].totalMarksLost).toBe(6.5);
  });
});

