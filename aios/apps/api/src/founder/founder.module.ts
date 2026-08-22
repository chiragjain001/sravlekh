import { Module } from '@nestjs/common';
import { FounderService } from './founder.service';
import { FounderController } from './founder.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FounderController],
  providers: [FounderService],
})
export class FounderModule {}
