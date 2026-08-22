import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  Optional,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentBundleDto, ReprocessDocumentDto, CreatePageRegionDto, UpdatePageRegionDto } from './dto/document.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

const MAX_FILES_PER_UPLOAD = 60; // generous headroom above a typical booklet's page count
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 07-SECURITY-SPECIFICATION.md §9: 10 MB/file for photo capture

@ApiTags('documents')
@ApiBearerAuth()
@Controller('institutes/:instituteId')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('document-bundles')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a document bundle for a PHOTO_CAPTURE_SUBJECTIVE delivery' })
  createBundle(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateDocumentBundleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.createBundle(instituteId, dto, user);
  }

  @Post('document-bundles/:bundleId/documents')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD, { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload page images for one booklet — one or more image files, one per page' })
  uploadDocument(
    @Param('instituteId') instituteId: string,
    @Param('bundleId') bundleId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.uploadDocument(instituteId, bundleId, files, idempotencyKey, user);
  }

  @Get('documents/:documentId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER, UserRole.STUDENT)
  @ApiOperation({ summary: 'Full document status — pages, regions, processing job statuses, identity resolution' })
  findById(
    @Param('instituteId') instituteId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.findById(instituteId, documentId, user);
  }

  @Get('documents/:documentId/pages/:pageId/image')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER, UserRole.STUDENT)
  @ApiOperation({ summary: 'Signed URL to a page image — processed by default, ?raw=true for the original (teacher/admin/reviewer only)' })
  getPageImageUrl(
    @Param('instituteId') instituteId: string,
    @Param('documentId') documentId: string,
    @Param('pageId') pageId: string,
    @Query('raw', new ParseBoolPipe({ optional: true })) @Optional() raw: boolean | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.getPageImageUrl(instituteId, documentId, pageId, raw ?? false, user);
  }

  @Post('documents/:documentId/reprocess')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Resume the pipeline from a specific stage, reusing retained artifacts from earlier stages' })
  reprocess(
    @Param('instituteId') instituteId: string,
    @Param('documentId') documentId: string,
    @Body() dto: ReprocessDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reprocess(instituteId, documentId, dto, user);
  }

  @Post('page-images/:pageImageId/regions')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Manually draw a region on a page image (not in 05-API-SPECIFICATION.md\'s literal endpoint list — see docs/33 Phase 10 write-up for why it was added)' })
  createRegion(
    @Param('instituteId') instituteId: string,
    @Param('pageImageId') pageImageId: string,
    @Body() dto: CreatePageRegionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.createRegion(instituteId, pageImageId, dto, user);
  }

  @Patch('page-regions/:regionId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Correct a region — drag-to-adjust bounding box, or re-map to a different question' })
  updateRegion(
    @Param('instituteId') instituteId: string,
    @Param('regionId') regionId: string,
    @Body() dto: UpdatePageRegionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.updateRegion(instituteId, regionId, dto, user);
  }
}
