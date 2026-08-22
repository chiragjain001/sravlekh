import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TimetableSlotType, UserRole } from '@prisma/client';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('TimetableService.createSlot — conflict checking (18-EDGE-CASES.md)', () => {
  let service: TimetableService;
  let prisma: {
    timetableSlot: { findFirst: jest.Mock; create: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const teacherActor: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const student: AuthenticatedUser = { ...teacherActor, id: 'student-1', role: UserRole.STUDENT };

  const baseDto = {
    type: TimetableSlotType.CLASS,
    title: 'Physics Revision',
    teacherUserId: 'teacher-1',
    roomRef: 'Room 204',
    startTime: '2026-08-01T10:00:00Z',
    endTime: '2026-08-01T11:00:00Z',
    isRecurring: false,
  };

  beforeEach(async () => {
    prisma = {
      timetableSlot: { findFirst: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
      ],
    }).compile();
    service = module.get(TimetableService);
  });

  it('rejects a student creating a slot', async () => {
    await expect(service.createSlot('inst-1', baseDto, student)).rejects.toThrow(ForbiddenException);
  });

  it('rejects an overlapping slot for the same teacher with 409, before persistence', async () => {
    prisma.timetableSlot.findFirst.mockResolvedValueOnce({ id: 'existing-1', title: 'Chemistry Doubt Session' });

    await expect(service.createSlot('inst-1', baseDto, teacherActor)).rejects.toThrow(ConflictException);
    expect(prisma.timetableSlot.create).not.toHaveBeenCalled();
  });

  it('rejects an overlapping slot for the same room with 409, before persistence', async () => {
    prisma.timetableSlot.findFirst
      .mockResolvedValueOnce(null) // no teacher conflict
      .mockResolvedValueOnce({ id: 'existing-2', title: 'Maths Extra Class' }); // room conflict

    await expect(service.createSlot('inst-1', baseDto, teacherActor)).rejects.toThrow(ConflictException);
    expect(prisma.timetableSlot.create).not.toHaveBeenCalled();
  });

  it('creates the slot when there is no conflict', async () => {
    prisma.timetableSlot.findFirst.mockResolvedValue(null);
    prisma.timetableSlot.create.mockResolvedValueOnce({ id: 'new-1', ...baseDto });

    await expect(service.createSlot('inst-1', baseDto, teacherActor)).resolves.toBeDefined();
    expect(prisma.timetableSlot.create).toHaveBeenCalledTimes(1);
  });

  it('checks the overlap window using lt/gt (not equality) on start/end time', async () => {
    prisma.timetableSlot.findFirst.mockResolvedValue(null);
    prisma.timetableSlot.create.mockResolvedValueOnce({ id: 'new-1', ...baseDto });

    await service.createSlot('inst-1', baseDto, teacherActor);

    expect(prisma.timetableSlot.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        instituteId: 'inst-1',
        teacherUserId: 'teacher-1',
        startTime: { lt: new Date(baseDto.endTime) },
        endTime: { gt: new Date(baseDto.startTime) },
      }),
    });
  });
});
