import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BatchesService } from './batches.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('BatchesService — curriculum (subjects/chapters/topics)', () => {
  let service: BatchesService;
  let prisma: {
    subject: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    chapter: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    topic: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'a@x.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    instituteId: 'inst-1',
  };

  beforeEach(async () => {
    prisma = {
      subject: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      chapter: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      topic: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [BatchesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BatchesService);
  });

  describe('updateSubject', () => {
    it('rejects a subject belonging to a different institute (tenant isolation)', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({ id: 'sub-1', instituteId: 'other-inst', deletedAt: null });

      await expect(service.updateSubject('inst-1', 'sub-1', { name: 'Chemistry' }, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects renaming to a name already used by another subject', async () => {
      prisma.subject.findUnique
        .mockResolvedValueOnce({ id: 'sub-1', instituteId: 'inst-1', name: 'Physics', deletedAt: null })
        .mockResolvedValueOnce({ id: 'sub-2', instituteId: 'inst-1', name: 'Chemistry' });

      await expect(service.updateSubject('inst-1', 'sub-1', { name: 'Chemistry' }, admin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a non-admin, non-founder actor outright', async () => {
      const teacher = { ...admin, role: UserRole.TEACHER };
      await expect(service.updateSubject('inst-1', 'sub-1', { name: 'Chemistry' }, teacher)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.subject.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('archiveSubject', () => {
    it('soft-deletes (sets deletedAt) rather than removing the row', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({ id: 'sub-1', instituteId: 'inst-1', deletedAt: null });
      prisma.subject.update.mockResolvedValueOnce({ id: 'sub-1', deletedAt: new Date() });

      await service.archiveSubject('inst-1', 'sub-1', admin);

      expect(prisma.subject.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('writes an audit log entry for the archive action', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({ id: 'sub-1', instituteId: 'inst-1', deletedAt: null });
      prisma.subject.update.mockResolvedValueOnce({});

      await service.archiveSubject('inst-1', 'sub-1', admin);

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('treats an already-archived subject as not found (cannot archive twice)', async () => {
      prisma.subject.findUnique.mockResolvedValueOnce({
        id: 'sub-1',
        instituteId: 'inst-1',
        deletedAt: new Date(),
      });

      await expect(service.archiveSubject('inst-1', 'sub-1', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllSubjects', () => {
    it('excludes archived subjects and archived chapters/topics from the nested tree', async () => {
      prisma.subject.findMany.mockResolvedValueOnce([]);

      await service.findAllSubjects('inst-1', admin);

      const call = prisma.subject.findMany.mock.calls[0]![0];
      expect(call.where).toEqual({ instituteId: 'inst-1', deletedAt: null });
      expect(call.include.chapters.where).toEqual({ deletedAt: null });
      expect(call.include.chapters.include.topics.where).toEqual({ deletedAt: null });
    });
  });

  describe('archiveChapter / archiveTopic', () => {
    it('archiveChapter rejects a chapter whose subject belongs to a different institute', async () => {
      prisma.chapter.findUnique.mockResolvedValueOnce({
        id: 'ch-1',
        deletedAt: null,
        subject: { instituteId: 'other-inst' },
      });

      await expect(service.archiveChapter('inst-1', 'ch-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('archiveTopic rejects a topic whose chapter/subject belongs to a different institute', async () => {
      prisma.topic.findUnique.mockResolvedValueOnce({
        id: 'top-1',
        deletedAt: null,
        chapter: { subject: { instituteId: 'other-inst' } },
      });

      await expect(service.archiveTopic('inst-1', 'top-1', admin)).rejects.toThrow(NotFoundException);
    });
  });
});
