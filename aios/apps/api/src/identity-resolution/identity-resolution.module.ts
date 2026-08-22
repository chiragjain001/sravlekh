import { Module } from '@nestjs/common';
import { IdentityResolutionService } from './identity-resolution.service';
import { IdentityResolutionController } from './identity-resolution.controller';

@Module({
  controllers: [IdentityResolutionController],
  providers: [IdentityResolutionService],
  exports: [IdentityResolutionService],
})
export class IdentityResolutionModule {}
