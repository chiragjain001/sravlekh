import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export interface UploadedMultipartFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MAX_CONCURRENT_MULTIPART_UPLOADS = Number(process.env['MAX_CONCURRENT_MULTIPART_UPLOADS'] ?? 3);
let activeMultipartUploads = 0;

function acquireUploadSlot(): void {
  if (activeMultipartUploads >= MAX_CONCURRENT_MULTIPART_UPLOADS) {
    throw new HttpException(
      {
        code: 'UPLOAD_CONCURRENCY_LIMIT',
        message: 'Too many concurrent file uploads in progress. Please retry in a few moments or use direct storage upload.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  activeMultipartUploads++;
}

function releaseUploadSlot(): void {
  activeMultipartUploads = Math.max(0, activeMultipartUploads - 1);
}

@Injectable()
export class FastifyFileInterceptor implements NestInterceptor {
  constructor(
    private readonly fieldName: string = 'file',
    private readonly options?: { limits?: { fileSize?: number } },
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<any>();

    // If already populated (e.g. mock in unit test or previous middleware)
    if (req.file) {
      return next.handle();
    }

    if (typeof req.isMultipart === 'function' && req.isMultipart()) {
      acquireUploadSlot();
      try {
        const part = await req.file({
          limits: {
            fileSize: this.options?.limits?.fileSize,
          },
        });

        if (part) {
          const buffer = await part.toBuffer();
          req.file = {
            fieldname: part.fieldname,
            originalname: part.filename,
            encoding: part.encoding,
            mimetype: part.mimetype,
            size: buffer.length,
            buffer,
          };

          // Attach text fields from the multipart payload to req.body
          if (part.fields) {
            req.body = req.body || {};
            for (const [key, field] of Object.entries(part.fields)) {
              if (field && typeof (field as any).value !== 'undefined') {
                req.body[key] = (field as any).value;
              }
            }
          }
        }
      } catch (err: any) {
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
          throw new BadRequestException(
            `File exceeds size limit of ${this.options?.limits?.fileSize ?? 'allowed'} bytes`,
          );
        }
        throw err;
      } finally {
        releaseUploadSlot();
      }
    }

    return next.handle();
  }
}

@Injectable()
export class FastifyFilesInterceptor implements NestInterceptor {
  constructor(
    private readonly fieldName: string = 'files',
    private readonly maxCount: number = 60,
    private readonly options?: { limits?: { fileSize?: number } },
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<any>();

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      return next.handle();
    }

    if (typeof req.isMultipart === 'function' && req.isMultipart()) {
      acquireUploadSlot();
      try {
        const parts = req.files({
          limits: {
            fileSize: this.options?.limits?.fileSize,
            files: this.maxCount,
          },
        });

        const files: UploadedMultipartFile[] = [];
        for await (const part of parts) {
          const buffer = await part.toBuffer();
          files.push({
            fieldname: part.fieldname,
            originalname: part.filename,
            encoding: part.encoding,
            mimetype: part.mimetype,
            size: buffer.length,
            buffer,
          });
        }
        req.files = files;
      } catch (err: any) {
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
          throw new BadRequestException(
            `File exceeds size limit of ${this.options?.limits?.fileSize ?? 'allowed'} bytes`,
          );
        }
        throw err;
      } finally {
        releaseUploadSlot();
      }
    }

    return next.handle();
  }
}
