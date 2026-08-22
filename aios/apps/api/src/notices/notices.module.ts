import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';
import { NoticeDispatchProcessor } from './notice-dispatch.processor';
import { NOTICE_DISPATCH_QUEUE } from './notice-dispatch.constants';

@Module({
  imports: [BullModule.registerQueue({ name: NOTICE_DISPATCH_QUEUE })],
  controllers: [NoticesController],
  providers: [NoticesService, NoticeDispatchProcessor],
  exports: [NoticesService],
})
export class NoticesModule {}
