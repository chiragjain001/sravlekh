import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';
import { NoticeWebhooksController } from './notice-webhooks.controller';
import { NoticeDispatchProcessor } from './notice-dispatch.processor';
import { NoticeDispatchService } from './notice-dispatch.service';
import { NOTICE_DISPATCH_QUEUE } from './notice-dispatch.constants';
import { SendGridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { WhatsAppCloudApiAdapter } from './adapters/whatsapp-cloud.adapter';
import { SmsGatewayAdapter } from './adapters/sms-gateway.adapter';

@Module({
  imports: [BullModule.registerQueue({ name: NOTICE_DISPATCH_QUEUE })],
  controllers: [NoticesController, NoticeWebhooksController],
  providers: [
    NoticesService,
    NoticeDispatchService,
    NoticeDispatchProcessor,
    SendGridEmailAdapter,
    WhatsAppCloudApiAdapter,
    SmsGatewayAdapter,
  ],
  exports: [NoticesService, NoticeDispatchService],
})
export class NoticesModule {}
