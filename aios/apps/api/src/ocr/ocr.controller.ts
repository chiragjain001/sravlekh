import { Controller, Post, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

/**
 * Not in 05-API-SPECIFICATION.md's literal endpoint list — that doc only
 * specifies the internal FastAPI contract (POST /ocr/extract) and expects
 * results "surfaced via GET /documents/:id." This endpoint is the real
 * trigger a teacher/admin calls to kick off extraction for a document's
 * already-mapped regions, deliberately kept separate from Phase 10's own
 * endpoints — see docs/33 Phase 11 write-up.
 */
@ApiTags('ocr')
@ApiBearerAuth()
@Controller('institutes/:instituteId/documents/:documentId/ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Extract text from every confirmed, not-yet-transcribed region on this document' })
  enqueueForDocument(
    @Param('instituteId') instituteId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ocrService.enqueueForDocument(instituteId, documentId, user);
  }
}
