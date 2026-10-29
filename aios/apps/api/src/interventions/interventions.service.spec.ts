import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InterventionsService } from './interventions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  InterventionFilterStatus,
  InterventionActionType,
} from './dto/intervention.dto';

function makeActor(role: UserRole, instituteId = 'inst-1', id = 'user-1'): AuthenticatedUser {
  return { id, email: 'user@test.edu', name: 'Test User', role, instituteId };
}

describe('InterventionsService', () => {
  let service: InterventionsService;
  let prisma: {
    intervention: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    batchTeacher: { findMany: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    masteryScore: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      intervention: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      batchTeacher: { findMany: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      masteryScore: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterventionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InterventionsService>(InterventionsService);
  });

  describe('listInterventions', () => {
    it('rejects cross-tenant requests', async () => {
      await expect(
        service.listInterventions('inst-other', {}, makeActor(UserRole.TEACHER, 'inst-1')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects teacher requesting unauthorized batch', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-allowed' }]);

      await expect(
        service.listInterventions(
          'inst-1',
          { batchId: 'batch-unauthorized' },
          makeActor(UserRole.TEACHER, 'inst-1'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns filtered and paginated interventions for allowed teacher', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      const mockItems = [
        {
          id: 'int-1',
          instituteId: 'inst-1',
          studentProfileId: 'sp-1',
          topicId: 'top-1',
          type: 'ASSIGNMENT',
          beforeMastery: 0.35,
          completedAt: null,
          studentProfile: {
            id: 'sp-1',
            rollNumber: 'R01',
            batchId: 'batch-1',
            user: { name: 'Aarav', email: 'aarav@test.edu' },
          },
          topic: {
            id: 'top-1',
            name: 'Thermodynamics',
            chapter: { id: 'ch-1', name: 'Heat', subject: { id: 'sub-1', name: 'Physics' } },
          },
        },
      ];

      prisma.intervention.findMany.mockResolvedValueOnce(mockItems);
      prisma.intervention.count.mockResolvedValueOnce(1);

      const result = await service.listInterventions(
        'inst-1',
        { status: InterventionFilterStatus.ACTIVE },
        makeActor(UserRole.TEACHER, 'inst-1'),
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0]!.beforeMastery).toBe(0.35);
    });
  });

  describe('getRemedialGroups', () => {
    it('groups struggling students by topic and batch for extra-class planning', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      const mockInterventions = [
        {
          id: 'int-1',
          studentProfileId: 'sp-1',
          topicId: 'top-1',
          beforeMastery: 0.30,
          studentProfile: {
            id: 'sp-1',
            rollNumber: '101',
            batchId: 'batch-1',
            batch: { id: 'batch-1', name: 'Class 10-A' },
            user: { name: 'Student 1' },
          },
          topic: {
            name: 'Quadratic Equations',
            chapter: { subject: { name: 'Mathematics' } },
          },
        },
        {
          id: 'int-2',
          studentProfileId: 'sp-2',
          topicId: 'top-1',
          beforeMastery: 0.40,
          studentProfile: {
            id: 'sp-2',
            rollNumber: '102',
            batchId: 'batch-1',
            batch: { id: 'batch-1', name: 'Class 10-A' },
            user: { name: 'Student 2' },
          },
          topic: {
            name: 'Quadratic Equations',
            chapter: { subject: { name: 'Mathematics' } },
          },
        },
      ];

      prisma.intervention.findMany.mockResolvedValueOnce(mockInterventions);

      const groups = await service.getRemedialGroups(
        'inst-1',
        { batchId: 'batch-1' },
        makeActor(UserRole.TEACHER, 'inst-1'),
      );

      expect(groups).toHaveLength(1);
      expect(groups[0]!.topicName).toBe('Quadratic Equations');
      expect(groups[0]!.studentCount).toBe(2);
      expect(groups[0]!.averageMastery).toBe(0.35);
      expect(groups[0]!.suggestedAction).toBe('EXTRA_CLASS');
    });
  });

  describe('actionIntervention', () => {
    it('throws NotFoundException if intervention does not exist', async () => {
      prisma.intervention.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.actionIntervention(
          'inst-1',
          'non-existent',
          { action: InterventionActionType.RESOLVE },
          makeActor(UserRole.TEACHER, 'inst-1'),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves intervention and records recovered afterMastery from MasteryScore', async () => {
      const mockIntervention = {
        id: 'int-1',
        instituteId: 'inst-1',
        studentProfileId: 'sp-1',
        topicId: 'top-1',
        type: 'ASSIGNMENT',
        studentProfile: { id: 'sp-1', batchId: 'batch-1' },
      };

      prisma.intervention.findUnique.mockResolvedValueOnce(mockIntervention);
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.masteryScore.findUnique.mockResolvedValueOnce({ masteryValue: 0.78 });
      prisma.intervention.update.mockResolvedValueOnce({ ...mockIntervention, completedAt: new Date(), afterMastery: 0.78 });

      const updated = await service.actionIntervention(
        'inst-1',
        'int-1',
        { action: InterventionActionType.RESOLVE, note: 'Passed remedial homework' },
        makeActor(UserRole.TEACHER, 'inst-1'),
      );

      expect(prisma.intervention.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            afterMastery: 0.78,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('converts intervention to EXTRA_CLASS with scheduled time', async () => {
      const mockIntervention = {
        id: 'int-1',
        instituteId: 'inst-1',
        studentProfileId: 'sp-1',
        topicId: 'top-1',
        type: 'ASSIGNMENT',
        studentProfile: { id: 'sp-1', batchId: 'batch-1' },
      };

      prisma.intervention.findUnique.mockResolvedValueOnce(mockIntervention);
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.intervention.update.mockResolvedValueOnce({ ...mockIntervention, type: 'EXTRA_CLASS' });

      await service.actionIntervention(
        'inst-1',
        'int-1',
        {
          action: InterventionActionType.CONVERT_TO_EXTRA_CLASS,
          scheduledAt: '2026-11-01T10:00:00.000Z',
          note: 'Group session scheduled in Room 204',
        },
        makeActor(UserRole.TEACHER, 'inst-1'),
      );

      expect(prisma.intervention.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EXTRA_CLASS',
          }),
        }),
      );
    });
  });
});
