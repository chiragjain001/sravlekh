import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PdfSplitProcessor } from './pdf-split.processor';
import { PDF_SPLIT_QUEUE } from './documents.constants';

@Module({
  imports: [BullModule.registerQueue({ name: PDF_SPLIT_QUEUE })],
  controllers: [DocumentsController],
  providers: [DocumentsService, PdfSplitProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
