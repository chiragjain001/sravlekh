import { Module } from '@nestjs/common';
import { IdentityResolutionService } from './identity-resolution.service';
import { IdentityResolutionController } from './identity-resolution.controller';
import { BookletsModule } from '../booklets/booklets.module';

@Module({
  imports: [BookletsModule],
  controllers: [IdentityResolutionController],
  providers: [IdentityResolutionService],
  exports: [IdentityResolutionService],
})
export class IdentityResolutionModule {}
