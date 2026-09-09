import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalFilesController } from './local-files.controller';

@Global()
@Module({
  controllers: [LocalFilesController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
