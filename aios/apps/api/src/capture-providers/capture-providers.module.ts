import { Module } from '@nestjs/common';
import { CaptureProvidersService } from './capture-providers.service';
import { CaptureProvidersController } from './capture-providers.controller';

@Module({
  controllers: [CaptureProvidersController],
  providers: [CaptureProvidersService],
  exports: [CaptureProvidersService],
})
export class CaptureProvidersModule {}
