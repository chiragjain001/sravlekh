import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException } from '@nestjs/common';
import { DeliveryStatus, NoticeChannel, UserRole } from '@prisma/client';
import { NoticesService } from './notices.service';
import { PrismaService } from '../prisma/prisma.service';
import { NOTICE_DISPATCH_QUEUE } from './notice-dispatch.constants';
import { AuthenticatedUser } from '../auth/auth.types';

describe('NoticesService.createNotice', () => {
  let service: NoticesService;
  let prisma: {
    notice: { create: jest.Mock };
    noticeDelivery: { createMany: jest.Mock };
    user: { findMany: jest.Mock };
    studentProfile: { findMany: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let queue: { add: jest.Mock };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };
  const student: AuthenticatedUser = { ...admin, id: 'student-1', role: UserRole.STUDENT };

  beforeEach(async () => {
    prisma = {
      notice: { create: jest.fn() },
      noticeDelivery: { createMany: jest.fn() },
      user: { findMany: jest.fn() },
      studentProfile: { findMany: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticesService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(NOTICE_DISPATCH_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(NoticesService);

    prisma.notice.create.mockResolvedValue({ id: 'notice-1', title: 't', channels: [] });
  });

  it('rejects a student broadcasting a notice', async () => {
    await expect(
      service.createNotice('inst-1', { title: 't', body: 'b', channels: [NoticeChannel.IN_APP], targetAudience: {} }, student),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a teacher broadcasting by role (not batch-scoped)', async () => {
    await expect(
      service.createNotice('inst-1', { title: 't', body: 'b', channels: [NoticeChannel.IN_APP], targetAudience: { roles: [UserRole.STUDENT] } }, teacher),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects a teacher targeting a batch they're not assigned to", async () => {
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
    prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-allowed' }]);

    await expect(
      service.createNotice('inst-1', { title: 't', body: 'b', channels: [NoticeChannel.IN_APP], targetAudience: { batchIds: ['batch-other'] } }, teacher),
    ).rejects.toThrow(ForbiddenException);
  });

  it('marks IN_APP deliveries SENT immediately, no provider needed', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'user-1' }]) // roles resolution
      .mockResolvedValueOnce([{ id: 'user-1', email: 'a@b.com', studentProfile: null }]); // recipient detail lookup

    await service.createNotice(
      'inst-1',
      { title: 't', body: 'b', channels: [NoticeChannel.IN_APP], targetAudience: { roles: [UserRole.STUDENT] } },
      admin,
    );

    expect(prisma.noticeDelivery.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'user-1', channel: NoticeChannel.IN_APP, status: DeliveryStatus.SENT })],
    });
    expect(queue.add).not.toHaveBeenCalled(); // nothing QUEUED, so no dispatch job needed
  });

  it('fails SMS immediately with no_contact_info when the recipient has no phone on file (18-EDGE-CASES.md)', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce([{ id: 'user-1', email: 'a@b.com', studentProfile: { guardianPhone: null } }]);

    await service.createNotice(
      'inst-1',
      { title: 't', body: 'b', channels: [NoticeChannel.SMS], targetAudience: { roles: [UserRole.STUDENT] } },
      admin,
    );

    expect(prisma.noticeDelivery.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ channel: NoticeChannel.SMS, status: DeliveryStatus.FAILED, failureReason: 'no_contact_info' })],
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues a dispatch job when a channel has real contact info to attempt', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'user-1' }])
      .mockResolvedValueOnce([{ id: 'user-1', email: 'a@b.com', studentProfile: { guardianPhone: '9999999999' } }]);

    await service.createNotice(
      'inst-1',
      { title: 't', body: 'b', channels: [NoticeChannel.SMS], targetAudience: { roles: [UserRole.STUDENT] } },
      admin,
    );

    expect(queue.add).toHaveBeenCalledWith('dispatch', { noticeId: 'notice-1' }, expect.any(Object));
  });
});
