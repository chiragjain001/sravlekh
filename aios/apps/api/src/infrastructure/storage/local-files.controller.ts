import { Controller, Get, Put, Query, Req, Res, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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
    try {
      const body = await this.storage.readLocalSigned(key, Number(exp), sig);
      res.setHeader('Content-Type', await this.storage.localContentType(key));
      res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop() ?? 'file'}"`);
      res.send(body);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        throw new NotFoundException('Requested file not found on storage.');
      }
      throw err;
    }
  }

  @Public()
  @Put('local-upload')
  async putLocalFile(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('type') type: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.storage.isLocalFallbackActive()) {
      throw new NotFoundException('Not found.');
    }
    const chunks: Buffer[] = [];
    if (Buffer.isBuffer(req.body)) {
      chunks.push(req.body);
    } else {
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
    }
    const buffer = Buffer.concat(chunks);
    await this.storage.writeLocalSigned(
      key,
      Number(exp),
      sig,
      buffer,
      type || (req.headers['content-type'] as string) || 'application/octet-stream',
    );
    res.status(200).json({ success: true });
  }
}
