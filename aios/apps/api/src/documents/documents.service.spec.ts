import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { UserRole, CaptureProviderType, DocumentLayoutType } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let docCreate: jest.Mock;
  let pageCreate: jest.Mock;
  let pageImageCreate: jest.Mock;
  let processingJobCreate: jest.Mock;
  let identityResolutionCreate: jest.Mock;
  let prisma: {
    assessmentDelivery: { findUnique: jest.Mock };
    documentBundle: { create: jest.Mock; findUnique: jest.Mock };
    document: { findUnique: jest.Mock; update: jest.Mock };
    page: { findUnique: jest.Mock };
    pageImage: { findUnique: jest.Mock };
    pageRegion: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
    processingJob: { findMany: jest.Mock; update: jest.Mock };
    question: { findUnique: jest.Mock };
    response: { deleteMany: jest.Mock; upsert: jest.Mock };
    attempt: { findUnique: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { buildKey: jest.Mock; upload: jest.Mock; getSignedDownloadUrl: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };
  const student: AuthenticatedUser = { id: 'user-student-1', email: 's@x.com', name: 'S', role: UserRole.STUDENT, instituteId: 'inst-1' };

  beforeEach(async () => {
    docCreate = jest.fn().mockResolvedValue({ id: 'doc-1', status: 'UPLOADED' });
    pageCreate = jest.fn().mockResolvedValue({ id: 'page-1' });
    pageImageCreate = jest.fn().mockResolvedValue({ id: 'img-1' });
    processingJobCreate = jest.fn().mockResolvedValue({});
    identityResolutionCreate = jest.fn().mockResolvedValue({});

    prisma = {
      assessmentDelivery: { findUnique: jest.fn() },
      documentBundle: { create: jest.fn(), findUnique: jest.fn() },
      document: { findUnique: jest.fn(), update: jest.fn() },
      page: { findUnique: jest.fn() },
      pageImage: { findUnique: jest.fn() },
      pageRegion: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      processingJob: { findMany: jest.fn(), update: jest.fn() },
      question: { findUnique: jest.fn() },
      response: { deleteMany: jest.fn(), upsert: jest.fn() },
      attempt: { findUnique: jest.fn() },
      studentProfile: { findUnique: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((arg: any) => {
        if (typeof arg === 'function') {
          return arg({
            document: { create: docCreate },
            page: { create: pageCreate },
            pageImage: { create: pageImageCreate },
            processingJob: { create: processingJobCreate },
            identityResolution: { create: identityResolutionCreate },
          });
        }
        return Promise.all(arg);
      }),
    };
    storage = {
      buildKey: jest.fn((...segments: string[]) => segments.join('/')),
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/file'),
    };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(DocumentsService);
  });

  describe('createBundle', () => {
    it('404s when the delivery does not exist', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce(null);
      await expect(service.createBundle('inst-1', { assessmentDeliveryId: 'd1' }, teacher)).rejects.toThrow(NotFoundException);
    });

    it('rejects a delivery whose capture provider is not PHOTO_CAPTURE_SUBJECTIVE (23 §2)', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'd1', assessment: { instituteId: 'inst-1' }, captureProvider: { type: CaptureProviderType.MANUAL_GRID },
      });
      await expect(service.createBundle('inst-1', { assessmentDeliveryId: 'd1' }, teacher)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadDocument', () => {
    const files = [{ buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 1000, originalname: 'p1.jpg' }];

    it('rejects a missing Idempotency-Key', async () => {
      await expect(service.uploadDocument('inst-1', 'b1', files, undefined, teacher)).rejects.toThrow(BadRequestException);
    });

    it('returns the cached result on a repeated Idempotency-Key without re-processing', async () => {
      cache.get.mockResolvedValueOnce({ documentId: 'doc-cached', status: 'UPLOADED' });
      const result = await service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher);
      expect(result).toEqual({ documentId: 'doc-cached', status: 'UPLOADED' });
      expect(prisma.documentBundle.findUnique).not.toHaveBeenCalled();
    });

    it('404s when the bundle does not exist', async () => {
      prisma.documentBundle.findUnique.mockResolvedValueOnce(null);
      await expect(service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher)).rejects.toThrow(NotFoundException);
    });

    function mockBundle(config: Record<string, unknown> = {}) {
      prisma.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'b1',
        assessmentDelivery: { assessment: { instituteId: 'inst-1' }, captureProvider: { type: CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE, config } },
      });
    }

    it('rejects an oversized file (413)', async () => {
      mockBundle();
      const bigFile = [{ ...files[0]!, size: 20 * 1024 * 1024 }];
      await expect(service.uploadDocument('inst-1', 'b1', bigFile, 'key-1', teacher)).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects a PDF upload — splitting is not implemented (422)', async () => {
      mockBundle();
      const pdfFile = [{ ...files[0]!, mimetype: 'application/pdf' }];
      await expect(service.uploadDocument('inst-1', 'b1', pdfFile, 'key-1', teacher)).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects an unsupported file type (422)', async () => {
      mockBundle();
      const badFile = [{ ...files[0]!, mimetype: 'text/plain' }];
      await expect(service.uploadDocument('inst-1', 'b1', badFile, 'key-1', teacher)).rejects.toThrow(UnprocessableEntityException);
    });

    it('sets layoutType=FREE_FORM when no bookletTemplateId is configured', async () => {
      mockBundle({});
      await service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher);
      expect(docCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ layoutType: DocumentLayoutType.FREE_FORM }) }));
    });

    it('sets layoutType=TEMPLATE_KNOWN when bookletTemplateId is configured', async () => {
      mockBundle({ bookletTemplateId: 'tpl-1' });
      await service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher);
      expect(docCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ layoutType: DocumentLayoutType.TEMPLATE_KNOWN } ) }));
    });

    it('creates a QUEUED ProcessingJob per pipeline stage, excluding OCR', async () => {
      mockBundle();
      await service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher);
      const stagesCreated = processingJobCreate.mock.calls.map((c) => c[0].data.stage);
      expect(stagesCreated).not.toContain('OCR');
      expect(stagesCreated.length).toBeGreaterThan(0);
    });

    it('creates a PENDING MANUAL_ADMIN_MATCH IdentityResolution row by default', async () => {
      mockBundle();
      await service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher);
      expect(identityResolutionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ method: 'MANUAL_ADMIN_MATCH', confidence: 0 }) }),
      );
    });

    it('caches the result under the Idempotency-Key', async () => {
      mockBundle();
      await service.uploadDocument('inst-1', 'b1', files, 'key-1', teacher);
      expect(cache.set).toHaveBeenCalledWith('idempotency:documents:inst-1:key-1', { documentId: 'doc-1', status: 'UPLOADED' }, expect.any(Number));
    });
  });

  describe('getPageImageUrl', () => {
    function mockDocumentAndPage(attemptId: string | null, processedImageUrl: string | null = null) {
      prisma.document.findUnique.mockResolvedValueOnce({
        id: 'doc-1', attemptId, documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
      prisma.page.findUnique.mockResolvedValueOnce({
        id: 'page-1', documentId: 'doc-1', images: [{ rawImageUrl: 'raw-key', processedImageUrl }],
      });
    }

    it('a teacher can request the raw image', async () => {
      mockDocumentAndPage('att-1');
      const result = await service.getPageImageUrl('inst-1', 'doc-1', 'page-1', true, teacher);
      expect(result.raw).toBe(true);
      expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('raw-key');
    });

    it('falls back to the raw image when processedImageUrl is not yet populated (no deskew worker exists)', async () => {
      mockDocumentAndPage('att-1', null);
      const result = await service.getPageImageUrl('inst-1', 'doc-1', 'page-1', false, teacher);
      expect(result.raw).toBe(true);
      expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('raw-key');
    });

    it("a student's ?raw=true request is ignored once a processed image exists — they get the processed URL", async () => {
      mockDocumentAndPage('att-1', 'processed-key');
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', userId: 'user-student-1' });
      prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });
      const result = await service.getPageImageUrl('inst-1', 'doc-1', 'page-1', true, student);
      expect(result.raw).toBe(false);
      expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('processed-key');
    });

    it("rejects a student requesting a document that isn't their own", async () => {
      mockDocumentAndPage('att-1');
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', userId: 'user-student-1' });
      prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-OTHER' });
      await expect(service.getPageImageUrl('inst-1', 'doc-1', 'page-1', false, student)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reprocess', () => {
    it('rejects a stage not in this document\'s pipeline path', async () => {
      prisma.document.findUnique.mockResolvedValueOnce({
        id: 'doc-1', layoutType: DocumentLayoutType.TEMPLATE_KNOWN, documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
      await expect(service.reprocess('inst-1', 'doc-1', { fromStage: 'LAYOUT_ANALYSIS' as any }, teacher)).rejects.toThrow(BadRequestException);
    });

    it('resets the given stage and every later stage to QUEUED', async () => {
      prisma.document.findUnique.mockResolvedValueOnce({
        id: 'doc-1', layoutType: DocumentLayoutType.TEMPLATE_KNOWN, documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
      prisma.processingJob.findMany.mockResolvedValueOnce([
        { id: 'j1', stage: 'VALIDATE', attemptCount: 1 },
        { id: 'j2', stage: 'DESKEW', attemptCount: 0 },
        { id: 'j3', stage: 'REGION_DETECT', attemptCount: 0 },
      ]);
      prisma.document.update.mockResolvedValueOnce({ id: 'doc-1', status: 'PAGE_PROCESSING' });

      await service.reprocess('inst-1', 'doc-1', { fromStage: 'DESKEW' as any }, teacher);

      expect(prisma.processingJob.update).toHaveBeenCalledTimes(2); // DESKEW and REGION_DETECT, not VALIDATE
    });
  });

  describe('createRegion / updateRegion', () => {
    it('creates a manually-drawn region with detectionMethod=MANUAL_TEACHER_MARKUP', async () => {
      prisma.pageImage.findUnique.mockResolvedValueOnce({
        id: 'img-1', page: { documentId: 'doc-1', document: { documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } } } },
      });
      prisma.question.findUnique.mockResolvedValueOnce({ id: 'q-1', instituteId: 'inst-1', marks: 5 });
      prisma.pageRegion.create.mockResolvedValueOnce({ id: 'region-1' });
      prisma.document.findUnique.mockResolvedValueOnce({ id: 'doc-1', attemptId: null }); // syncPageRegionResponses' lookup

      await service.createRegion(
        'inst-1', 'img-1',
        { boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, regionType: 'QUESTION_ANSWER' as any, questionId: 'q-1' },
        teacher,
      );

      expect(prisma.pageRegion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ detectionMethod: 'MANUAL_TEACHER_MARKUP', questionId: 'q-1' }) }),
      );
    });

    it('deletes the stale Response when a region is remapped to a different question', async () => {
      prisma.pageRegion.findUnique.mockResolvedValueOnce({
        id: 'region-1', questionId: 'q-old', pageImage: { page: { documentId: 'doc-1' } },
      });
      prisma.document.findUnique
        .mockResolvedValueOnce({ id: 'doc-1', documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } } })
        .mockResolvedValueOnce({ id: 'doc-1', attemptId: null }); // syncPageRegionResponses' own lookup
      prisma.question.findUnique.mockResolvedValueOnce({ id: 'q-new', instituteId: 'inst-1', marks: 5 });
      prisma.pageRegion.update.mockResolvedValueOnce({ id: 'region-1', questionId: 'q-new' });

      await service.updateRegion('inst-1', 'region-1', { questionId: 'q-new' }, teacher);

      expect(prisma.response.deleteMany).toHaveBeenCalledWith({ where: { questionRegionId: 'region-1' } });
    });
  });
});
