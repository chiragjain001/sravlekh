import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController, ChangesController } from './audit.controller';

@Module({
  controllers: [AuditController, ChangesController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
