import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
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
      }
    }

    return next.handle();
  }
}
