import { Module } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { BatchesController } from './batches.controller';
import { BatchBulkImportService } from './batch-bulk-import.service';

@Module({
  controllers: [BatchesController],
  providers: [BatchesService, BatchBulkImportService],
  exports: [BatchesService, BatchBulkImportService],
})
export class BatchesModule {}
