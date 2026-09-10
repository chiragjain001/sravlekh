import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

/**
 * Global because plan enforcement is cross-cutting: any module that creates a
 * billable resource needs it, and threading it through every feature module's
 * imports would make the enforcement points harder to add (and therefore
 * easier to forget) than they already are.
 */
@Global()
@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
