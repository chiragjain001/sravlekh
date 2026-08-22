import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { OcrService } from './ocr.service';
import { OCR_QUEUE } from './ocr.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { AuthenticatedUser } from '../auth/auth.types';

jest.mock('axios');
import axios from 'axios';

describe('OcrService', () => {
  let service: OcrService;
  let prisma: { document: { findUnique: jest.Mock }; pageRegion: { findMany: jest.Mock } };
  let storage: { getSignedDownloadUrl: jest.Mock };
  let queue: { add: jest.Mock };
  let config: { get: jest.Mock };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };
  const otherTeacher: AuthenticatedUser = { ...teacher, id: 'teacher-2', instituteId: 'inst-2' };

  beforeEach(async () => {
    prisma = { document: { findUnique: jest.fn() }, pageRegion: { findMany: jest.fn() } };
    storage = { getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/img') };
    queue = { add: jest.fn().mockResolvedValue({}) };
    config = { get: jest.fn((key: string) => (key === 'PYTHON_SERVICE_URL' ? 'http://python:8000' : 'internal-token-1')) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: ConfigService, useValue: config },
        { provide: getQueueToken(OCR_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(OcrService);
    (axios.post as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  describe('enqueueForDocument', () => {
    it('rejects a cross-tenant actor', async () => {
      await expect(service.enqueueForDocument('inst-1', 'doc-1', otherTeacher)).rejects.toThrow(ForbiddenException);
    });

    it('404s when the document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValueOnce(null);
      await expect(service.enqueueForDocument('inst-1', 'doc-1', teacher)).rejects.toThrow(NotFoundException);
    });

    function mockDocument() {
      prisma.document.findUnique.mockResolvedValueOnce({
        id: 'doc-1', documentBundle: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
      });
    }

    it('skips a region that already has an OCRResult', async () => {
      mockDocument();
      prisma.pageRegion.findMany.mockResolvedValueOnce([
        { id: 'region-1', pageImage: { rawImageUrl: 'raw-1', processedImageUrl: null }, ocrBlocks: [{ results: [{ id: 'r1' }] }] },
      ]);

      const result = await service.enqueueForDocument('inst-1', 'doc-1', teacher);

      expect(queue.add).not.toHaveBeenCalled();
      expect(result).toEqual({ enqueuedCount: 0, totalRegions: 1 });
    });

    it('enqueues a job with the storage key (not a pre-signed URL) and blockType=HANDWRITTEN_TEXT', async () => {
      mockDocument();
      prisma.pageRegion.findMany.mockResolvedValueOnce([
        { id: 'region-1', pageImage: { rawImageUrl: 'raw-1', processedImageUrl: null }, ocrBlocks: [] },
      ]);

      await service.enqueueForDocument('inst-1', 'doc-1', teacher);

      expect(queue.add).toHaveBeenCalledWith(
        'extract',
        { instituteId: 'inst-1', questionRegionId: 'region-1', imageKey: 'raw-1', blockType: 'HANDWRITTEN_TEXT' },
        expect.any(Object),
      );
      expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled(); // signing happens at process time, not enqueue time
    });

    it('prefers the processed image key over the raw one when both exist', async () => {
      mockDocument();
      prisma.pageRegion.findMany.mockResolvedValueOnce([
        { id: 'region-1', pageImage: { rawImageUrl: 'raw-1', processedImageUrl: 'processed-1' }, ocrBlocks: [] },
      ]);

      await service.enqueueForDocument('inst-1', 'doc-1', teacher);

      expect(queue.add).toHaveBeenCalledWith('extract', expect.objectContaining({ imageKey: 'processed-1' }), expect.any(Object));
    });
  });

  describe('requestOcrExtraction', () => {
    it('signs the image key fresh and posts to the internal FastAPI endpoint', async () => {
      await service.requestOcrExtraction({ instituteId: 'inst-1', questionRegionId: 'region-1', imageKey: 'raw-1', blockType: 'HANDWRITTEN_TEXT' });

      expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith('raw-1', 600);
      expect(axios.post).toHaveBeenCalledWith(
        'http://python:8000/ocr/extract',
        { instituteId: 'inst-1', questionRegionId: 'region-1', imageUrl: 'https://signed.example/img', blockType: 'HANDWRITTEN_TEXT' },
        expect.objectContaining({ headers: { 'X-Internal-Token': 'internal-token-1' } }),
      );
    });

    it('rethrows on failure so the queue retries', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('down'));
      await expect(
        service.requestOcrExtraction({ instituteId: 'inst-1', questionRegionId: 'region-1', imageKey: 'raw-1', blockType: 'HANDWRITTEN_TEXT' }),
      ).rejects.toThrow('down');
    });
  });
});
