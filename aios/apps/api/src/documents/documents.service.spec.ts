import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { UserRole, CaptureProviderType, DocumentLayoutType, QuestionType } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import axios from 'axios';
import { PDF_SPLIT_QUEUE } from './documents.constants';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Real file signatures — the service sniffs bytes, not the declared type. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from('%PDF-1.7\n% test', 'latin1');
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
    document: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    page: { findUnique: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    pageImage: { findUnique: jest.Mock };
    pageRegion: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; delete: jest.Mock };
    processingJob: { findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    question: { findUnique: jest.Mock };
    response: { deleteMany: jest.Mock; upsert: jest.Mock; findMany: jest.Mock };
    attempt: { findUnique: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    paperItem: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { buildKey: jest.Mock; upload: jest.Mock; getSignedDownloadUrl: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };
  let pdfSplitQueue: { add: jest.Mock };

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
      document: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'doc-1' }), findMany: jest.fn() },
      page: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      pageImage: { findUnique: jest.fn() },
      pageRegion: { create: jest.fn().mockResolvedValue({ id: 'region-new' }), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue({}) },
      processingJob: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      question: { findUnique: jest.fn() },
      response: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      attempt: { findUnique: jest.fn() },
      studentProfile: { findUnique: jest.fn() },
      paperItem: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((arg: any) => {
        if (typeof arg === 'function') {
          return arg({
            document: {
              create: docCreate,
              update: prisma.document.update,
              findUnique: prisma.document.findUnique,
            },
            page: { create: pageCreate },
            pageImage: { create: pageImageCreate },
            pageRegion: { delete: prisma.pageRegion.delete },
            response: { deleteMany: prisma.response.deleteMany },
            processingJob: { create: processingJobCreate, updateMany: prisma.processingJob.updateMany },
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
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    pdfSplitQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: CacheService, useValue: cache },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'PYTHON_SERVICE_URL' ? 'http://py' : undefined) } },
        { provide: getQueueToken(PDF_SPLIT_QUEUE), useValue: pdfSplitQueue },
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

    it('refuses when the documentProcessing feature flag is disabled for the institute (Founder Console Phase 3)', async () => {
      featureFlags.isEnabled.mockResolvedValueOnce(false);
      await expect(service.createBundle('inst-1', { assessmentDeliveryId: 'd1' }, teacher)).rejects.toThrow(ForbiddenException);
      expect(prisma.assessmentDelivery.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findDocumentsForBundle', () => {
    it('404s when the bundle does not exist', async () => {
      prisma.documentBundle.findUnique.mockResolvedValueOnce(null);
      await expect(service.findDocumentsForBundle('inst-1', 'b1', teacher)).rejects.toThrow(NotFoundException);
    });

    it("404s when the bundle belongs to a different institute", async () => {
      prisma.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'b1', assessmentDelivery: { assessment: { instituteId: 'inst-OTHER' } },
      });
      await expect(service.findDocumentsForBundle('inst-1', 'b1', teacher)).rejects.toThrow(NotFoundException);
    });

    it('lists documents for a real bundle in this institute', async () => {
      prisma.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'b1', assessmentDelivery: { assessment: { instituteId: 'inst-1' } },
      });
      prisma.document.findMany.mockResolvedValueOnce([{ id: 'doc-1', status: 'UPLOADED' }]);

      const result = await service.findDocumentsForBundle('inst-1', 'b1', teacher);

      expect(result).toEqual([{ id: 'doc-1', status: 'UPLOADED' }]);
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { documentBundleId: 'b1' } }),
      );
    });
  });

  describe('uploadDocument', () => {
    const files = [{ buffer: JPEG, mimetype: 'image/jpeg', size: 1000, originalname: 'p1.jpg' }];

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

    it('rejects an oversized image (413)', async () => {
      mockBundle();
      const bigFile = [{ ...files[0]!, size: 20 * 1024 * 1024 }];
      await expect(service.uploadDocument('inst-1', 'b1', bigFile, 'key-1', teacher)).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects an oversized PDF (413)', async () => {
      mockBundle();
      const bigPdf = [{ buffer: PDF, mimetype: 'application/pdf', size: 30 * 1024 * 1024, originalname: 'booklet.pdf' }];
      await expect(service.uploadDocument('inst-1', 'b1', bigPdf, 'key-1', teacher)).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects a file whose bytes are not an accepted type, whatever it claims to be (422)', async () => {
      mockBundle();
      const disguised = [{ buffer: Buffer.from('<?php echo 1; ?>'), mimetype: 'image/jpeg', size: 16, originalname: 'p1.jpg' }];
      await expect(service.uploadDocument('inst-1', 'b1', disguised, 'key-1', teacher)).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts a real PNG that claims to be a JPEG — the bytes decide', async () => {
      mockBundle();
      await service.uploadDocument('inst-1', 'b1', [{ buffer: PNG, mimetype: 'image/jpeg', size: 100, originalname: 'p1.jpg' }], 'key-1', teacher);
      expect(storage.upload).toHaveBeenCalledWith(expect.stringContaining('page-1.png'), PNG, 'image/png');
    });

    it('never puts the client filename in the storage key', async () => {
      mockBundle();
      const nasty = [{ buffer: JPEG, mimetype: 'image/jpeg', size: 100, originalname: '../../../etc/passwd.jpg' }];
      await service.uploadDocument('inst-1', 'b1', nasty, 'key-1', teacher);
      const key = storage.upload.mock.calls[0][0] as string;
      expect(key).not.toContain('passwd');
      expect(key).not.toContain('..');
      expect(key).toContain('page-1.jpg');
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
      expect(cache.set).toHaveBeenCalledWith('idempotency:documents:inst-1:key-1', { documentId: 'doc-1', status: 'UPLOADED', pageCount: 1 }, expect.any(Number));
    });
  });

  describe('uploadDocument — PDF booklet', () => {
    const pdfFiles = [{ buffer: PDF, mimetype: 'application/pdf', size: 2000, originalname: 'booklet.pdf' }];

    function mockBundle() {
      prisma.documentBundle.findUnique.mockResolvedValueOnce({
        id: 'b1',
        assessmentDelivery: { assessment: { instituteId: 'inst-1' }, captureProvider: { type: CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE, config: {} } },
      });
    }

    it('stores the original PDF privately and queues the render instead of rejecting it', async () => {
      mockBundle();
      const result = await service.uploadDocument('inst-1', 'b1', pdfFiles, 'key-1', teacher);

      expect(result).toEqual({ documentId: 'doc-1', status: 'PAGE_PROCESSING', pageCount: null });
      expect(storage.upload).toHaveBeenCalledWith(expect.stringContaining('source.pdf'), PDF, 'application/pdf');
      expect(pdfSplitQueue.add).toHaveBeenCalledWith(
        'split',
        { instituteId: 'inst-1', documentId: 'doc-1' },
        expect.objectContaining({ jobId: expect.stringContaining('doc-1') }),
      );
      // No pages yet: they are written when the render comes back.
      expect(pageCreate).not.toHaveBeenCalled();
    });

    it('refuses a PDF mixed with other files — one PDF is one booklet', async () => {
      mockBundle();
      const mixed = [...pdfFiles, { buffer: JPEG, mimetype: 'image/jpeg', size: 100, originalname: 'p1.jpg' }];
      await expect(service.uploadDocument('inst-1', 'b1', mixed, 'key-1', teacher)).rejects.toThrow(BadRequestException);
      expect(pdfSplitQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('splitPdfDocument', () => {
    const job = { instituteId: 'inst-1', documentId: 'doc-1' };

    function renderReturns(pageCount: number) {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            pageCount,
            pages: Array.from({ length: pageCount }, (_, i) => ({
              pageNumber: i + 1, width: 1200, height: 1700,
              imageBase64: Buffer.from(`page-${i + 1}`).toString('base64'), contentType: 'image/jpeg',
            })),
          },
        },
      });
    }

    beforeEach(() => {
      mockedAxios.post.mockReset();
      mockedAxios.isAxiosError.mockImplementation((e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError);
      prisma.document.findUnique.mockResolvedValue({ id: 'doc-1', sourceFileKey: 'institutes/inst-1/documents/doc-1/source.pdf', pages: [] });
    });

    it('writes one page and image per rendered page, then moves the document on', async () => {
      renderReturns(3);
      await service.splitPdfDocument(job);

      expect(storage.upload).toHaveBeenCalledTimes(3);
      expect(pageCreate).toHaveBeenCalledTimes(3);
      expect(pageImageCreate).toHaveBeenCalledTimes(3);
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IDENTITY_PENDING', expectedPageCount: 3 }) }),
      );
    });

    it('does nothing when the document already has pages (a retry after a win)', async () => {
      prisma.document.findUnique.mockResolvedValue({ id: 'doc-1', sourceFileKey: 'k', pages: [{ id: 'p1' }] });
      await service.splitPdfDocument(job);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('fails the document with the reason when the PDF itself is unreadable, instead of retrying forever', async () => {
      mockedAxios.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 422, data: { detail: 'This PDF is password-protected.' } } });
      await service.splitPdfDocument(job);

      expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED' } }));
      expect(prisma.processingJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorMessage: 'This PDF is password-protected.' }) }),
      );
    });

    it('rethrows a transient render failure so the queue retries it', async () => {
      mockedAxios.post.mockRejectedValueOnce({ isAxiosError: true, message: 'socket hang up' });
      await expect(service.splitPdfDocument(job)).rejects.toBeDefined();
      expect(prisma.document.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED' } }));
    });
  });

  describe('detectRegions', () => {
    const subjectiveQuestion = { id: 'q-1', type: QuestionType.LONG_ANSWER, content: 'Explain photosynthesis', marks: 5 };
    const mcqQuestion = { id: 'q-2', type: QuestionType.MCQ, content: 'Pick one', marks: 1 };

    function pageWithImage(regions: { id: string; regionType: string }[] = []) {
      return [{ id: 'page-1', pageNumber: 1, images: [{ id: 'img-1', rawImageUrl: 'raw/1.jpg', processedImageUrl: null, regions }] }];
    }

    beforeEach(() => {
      mockedAxios.post.mockReset();
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1', layoutType: DocumentLayoutType.FREE_FORM,
        documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
      prisma.paperItem.findMany.mockResolvedValue([
        { order: 0, marks: 5, question: subjectiveQuestion },
        { order: 1, marks: 1, question: mcqQuestion },
      ]);
    });

    it('creates a mapped region for a confident suggestion and an unmapped one otherwise', async () => {
      prisma.page.findMany.mockResolvedValue(pageWithImage());
      mockedAxios.post.mockResolvedValueOnce({ data: { data: [
        { questionNumber: 1, boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, confidence: 0.95, mapped: true },
        { questionNumber: null, boundingBox: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 }, confidence: 0.4, mapped: false },
      ] } });

      const result = await service.detectRegions('inst-1', 'doc-1', teacher);

      expect(result).toMatchObject({ pagesProcessed: 1, created: 2, unmapped: 1, needsMapping: true });
      const created = prisma.pageRegion.create.mock.calls.map((c) => c[0].data);
      expect(created[0]).toMatchObject({ questionId: 'q-1', detectionMethod: 'AUTO_LAYOUT_DETECTION', detectionConfidence: 0.95 });
      expect(created[1]).toMatchObject({ questionId: null });
    });

    it('never auto-maps an objective question — those are scored at capture, not from a region', async () => {
      prisma.page.findMany.mockResolvedValue(pageWithImage());
      mockedAxios.post.mockResolvedValueOnce({ data: { data: [
        { questionNumber: 2, boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, confidence: 0.99, mapped: true },
      ] } });

      const result = await service.detectRegions('inst-1', 'doc-1', teacher);
      expect(prisma.pageRegion.create.mock.calls[0][0].data.questionId).toBeNull();
      expect(result.unmapped).toBe(1);
    });

    it("leaves a page alone once it has answer regions — a teacher's work is never overwritten", async () => {
      prisma.page.findMany.mockResolvedValue(pageWithImage([{ id: 'r-existing', regionType: 'QUESTION_ANSWER' }]));
      const result = await service.detectRegions('inst-1', 'doc-1', teacher);
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(result).toMatchObject({ pagesProcessed: 0, created: 0 });
    });

    it('survives a detection failure on one page instead of failing the whole booklet', async () => {
      prisma.page.findMany.mockResolvedValue([
        ...pageWithImage(),
        { id: 'page-2', pageNumber: 2, images: [{ id: 'img-2', rawImageUrl: 'raw/2.jpg', processedImageUrl: null, regions: [] }] },
      ]);
      mockedAxios.post
        .mockRejectedValueOnce({ isAxiosError: true, message: 'model unavailable' })
        .mockResolvedValueOnce({ data: { data: [
          { questionNumber: 1, boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, confidence: 0.9, mapped: true },
        ] } });

      const result = await service.detectRegions('inst-1', 'doc-1', teacher);
      expect(result).toMatchObject({ pagesProcessed: 1, created: 1 });
    });

    it('waits out a provider rate limit once, then reports the page as needing another try', async () => {
      jest.useFakeTimers();
      try {
        prisma.page.findMany.mockResolvedValue(pageWithImage());
        const rateLimited = { isAxiosError: true, response: { status: 429, headers: { 'retry-after': '2' } } };
        mockedAxios.isAxiosError.mockImplementation((e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError);
        mockedAxios.post.mockRejectedValueOnce(rateLimited).mockRejectedValueOnce(rateLimited);

        const pending = service.detectRegions('inst-1', 'doc-1', teacher);
        await jest.advanceTimersByTimeAsync(2000);
        const result = await pending;

        expect(mockedAxios.post).toHaveBeenCalledTimes(2); // waited, tried again
        expect(result).toMatchObject({ created: 0, pagesProcessed: 0, rateLimitedPages: 1 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('refuses when the booklet has no pages yet', async () => {
      prisma.page.findMany.mockResolvedValue([]);
      await expect(service.detectRegions('inst-1', 'doc-1', teacher)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleting or re-mapping a region that already has confirmed marks', () => {
    const region = { id: 'region-1', questionId: 'q-old', pageImage: { page: { documentId: 'doc-1' } } };

    beforeEach(() => {
      prisma.pageRegion.findUnique.mockResolvedValue(region);
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1', documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
      prisma.question.findUnique.mockResolvedValue({ id: 'q-new', instituteId: 'inst-1' });
    });

    function responseWith(source: string | null) {
      return [{ id: 'resp-1', evaluation: source ? { currentVersion: { source } } : null }];
    }

    it('refuses to delete it without an explicit discard, and keeps the marks', async () => {
      prisma.response.findMany.mockResolvedValue(responseWith('TEACHER'));
      await expect(service.deleteRegion('inst-1', 'region-1', false, teacher)).rejects.toMatchObject({
        response: { code: 'REGION_HAS_FINAL_MARKS' },
      });
      expect(prisma.pageRegion.delete).not.toHaveBeenCalled();
      expect(prisma.response.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes it when the teacher confirms the marks may go', async () => {
      prisma.response.findMany.mockResolvedValue(responseWith('TEACHER'));
      await service.deleteRegion('inst-1', 'region-1', true, teacher);
      expect(prisma.response.deleteMany).toHaveBeenCalledWith({ where: { questionRegionId: 'region-1' } });
      expect(prisma.pageRegion.delete).toHaveBeenCalledWith({ where: { id: 'region-1' } });
    });

    it('deletes an AI-suggested-only region without asking — nothing official is lost', async () => {
      prisma.response.findMany.mockResolvedValue(responseWith('AI'));
      await service.deleteRegion('inst-1', 'region-1', false, teacher);
      expect(prisma.pageRegion.delete).toHaveBeenCalled();
    });

    it('refuses to re-map it to another question without an explicit discard', async () => {
      prisma.response.findMany.mockResolvedValue(responseWith('REVIEWER'));
      await expect(
        service.updateRegion('inst-1', 'region-1', { questionId: 'q-new' }, teacher),
      ).rejects.toMatchObject({ response: { code: 'REGION_HAS_FINAL_MARKS' } });
      expect(prisma.pageRegion.update).not.toHaveBeenCalled();
    });

    it('allows resizing it — the box change invalidates the OCR, it does not discard marks', async () => {
      prisma.response.findMany.mockResolvedValue(responseWith('TEACHER'));
      prisma.pageRegion.update.mockResolvedValue({ id: 'region-1' });
      await service.updateRegion('inst-1', 'region-1', { boundingBox: { x: 0.2, y: 0.2, width: 0.5, height: 0.2 } }, teacher);
      expect(prisma.pageRegion.update).toHaveBeenCalled();
      expect(prisma.response.deleteMany).not.toHaveBeenCalled();
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

    // 13-TESTING-STRATEGY.md v2 addendum: "cross-tenant document/page-image
    // access attempts via guessed signed-URL patterns" — a real documentId
    // that just happens to belong to another institute must 404 before any
    // signed URL is ever minted, never leak via a ForbiddenException (which
    // would confirm the resource exists) or a successful response.
    it("404s (never mints a signed URL) for a documentId belonging to a different institute", async () => {
      prisma.document.findUnique.mockResolvedValueOnce({
        id: 'doc-1', attemptId: 'att-1', documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-OTHER' } } },
      });
      await expect(service.getPageImageUrl('inst-1', 'doc-1', 'page-1', true, teacher)).rejects.toThrow(NotFoundException);
      expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
    });

    it("404s (never mints a signed URL) for a guessed pageId belonging to a different document", async () => {
      prisma.document.findUnique.mockResolvedValueOnce({
        id: 'doc-1', attemptId: 'att-1', documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
      prisma.page.findUnique.mockResolvedValueOnce({
        id: 'page-1', documentId: 'doc-OTHER', images: [{ rawImageUrl: 'raw-key', processedImageUrl: null }],
      });
      await expect(service.getPageImageUrl('inst-1', 'doc-1', 'page-1', true, teacher)).rejects.toThrow(NotFoundException);
      expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
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

