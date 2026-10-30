import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { UserRole } from '@prisma/client';

describe('Direct Document Upload & Confirmation Safeguards', () => {
  let service: DocumentsService;
  let prismaMock: any;
  let storageMock: any;
  let cacheMock: any;
  let queueMock: any;
  let featureFlagsMock: any;
  let configMock: any;
  let identityResolutionMock: any;

  const actor = {
    id: 'teacher-1',
    instituteId: 'inst-1',
    name: 'Test Teacher',
    email: 'teacher@test.com',
    role: UserRole.TEACHER,
    tokenVersion: 0,
  };

  beforeEach(() => {
    prismaMock = {
      documentBundle: {
        findUnique: jest.fn(),
      },
      document: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      processingJob: {
        create: jest.fn(),
      },
      identityResolution: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    storageMock = {
      buildKey: jest.fn((inst, ...segs) => ['institutes', inst, ...segs].join('/')),
      getSignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-put'),
      exists: jest.fn().mockResolvedValue(true),
    };

    cacheMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };

    featureFlagsMock = {
      isEnabled: jest.fn().mockResolvedValue(false),
    };

    configMock = {
      get: jest.fn().mockReturnValue(undefined),
    };

    identityResolutionMock = {
      resolveBatch: jest.fn(),
    };

    service = new DocumentsService(
      prismaMock as any,
      storageMock as any,
      cacheMock as any,
      featureFlagsMock as any,
      configMock as any,
      queueMock as any,
      identityResolutionMock as any,
    );
  });

  describe('confirmUpload', () => {
    const validKey = 'institutes/inst-1/documents/pending/bundle-1/upload-123.pdf';

    const validDto = { key: validKey, mimeType: 'application/pdf' };

    it('rejects confirmation if storage key does not match institute/bundle prefix', async () => {
      await expect(
        service.confirmUpload(
          'inst-1',
          'bundle-1',
          { key: 'institutes/inst-2/documents/pending/bundle-2/evil.pdf', mimeType: 'application/pdf' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects confirmation if document bundle does not exist or belongs to another institute', async () => {
      prismaMock.documentBundle.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.confirmUpload('inst-1', 'bundle-1', validDto, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns existing document without re-creating rows or enqueuing duplicate jobs (idempotency)', async () => {
      prismaMock.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'bundle-1',
        assessmentDelivery: { assessment: { instituteId: 'inst-1' } },
      });

      prismaMock.document.findFirst.mockResolvedValueOnce({
        id: 'doc-already-exists',
        status: 'PAGE_PROCESSING',
        expectedPageCount: 12,
      });

      const result = await service.confirmUpload('inst-1', 'bundle-1', validDto, actor);

      expect(result).toEqual({
        documentId: 'doc-already-exists',
        status: 'PAGE_PROCESSING',
        pageCount: 12,
      });
      expect(prismaMock.document.create).not.toHaveBeenCalled();
      expect(queueMock.add).not.toHaveBeenCalled();
    });

    it('rejects confirmation if file does not exist in storage', async () => {
      prismaMock.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'bundle-1',
        assessmentDelivery: { assessment: { instituteId: 'inst-1' } },
      });
      prismaMock.document.findFirst.mockResolvedValueOnce(null);
      storageMock.exists.mockResolvedValueOnce(false); // file absent in S3/storage

      await expect(
        service.confirmUpload('inst-1', 'bundle-1', validDto, actor),
      ).rejects.toThrow(/Uploaded file was not found in storage/);
      expect(prismaMock.document.create).not.toHaveBeenCalled();
    });

    it('successfully confirms upload, creates document and enqueues pdf-split when valid', async () => {
      prismaMock.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'bundle-1',
        assessmentDelivery: { assessment: { instituteId: 'inst-1' } },
      });
      prismaMock.document.findFirst.mockResolvedValueOnce(null);
      storageMock.exists.mockResolvedValueOnce(true);
      prismaMock.document.create.mockResolvedValueOnce({
        id: 'new-doc-1',
        status: 'PAGE_PROCESSING',
      });

      const result = await service.confirmUpload('inst-1', 'bundle-1', validDto, actor);

      expect(result.documentId).toBe('new-doc-1');
      expect(result.status).toBe('PAGE_PROCESSING');
      expect(prismaMock.document.create).toHaveBeenCalled();
      expect(queueMock.add).toHaveBeenCalledWith(
        'split',
        expect.objectContaining({ documentId: 'new-doc-1', instituteId: 'inst-1' }),
        expect.anything(),
      );
    });
  });
});
