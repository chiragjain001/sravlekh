import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { OcrProcessor } from './ocr.processor';
import { OCR_QUEUE } from './ocr.constants';

@Module({
  imports: [BullModule.registerQueue({ name: OCR_QUEUE })],
  controllers: [OcrController],
  providers: [OcrService, OcrProcessor],
  exports: [OcrService],
})
export class OcrModule {}
