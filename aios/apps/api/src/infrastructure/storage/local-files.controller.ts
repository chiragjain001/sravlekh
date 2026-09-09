import { Controller, Get, Query, Res, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { StorageService } from './storage.service';

/**
 * Serves files written by StorageService's development disk fallback.
 *
 * @Public() because the URL authenticates itself: the query carries an
 * HMAC signature over (key, expiry) that StorageService verifies, exactly like
 * an S3 presigned link — a browser opening a download link cannot send a bearer
 * token. It refuses everything unless that fallback is active, so on a properly
 * configured deployment (S3 set, or production) this route is inert.
 */
@ApiExcludeController()
@Controller('files')
export class LocalFilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('local')
  async getLocalFile(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!this.storage.isLocalFallbackActive()) {
      throw new NotFoundException('Not found.');
    }
    const body = await this.storage.readLocalSigned(key, Number(exp), sig);
    res.setHeader('Content-Type', await this.storage.localContentType(key));
    res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop() ?? 'file'}"`);
    res.send(body);
  }
}
