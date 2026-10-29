import { Controller, Post, Get, Body, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { NoticeDispatchService } from './notice-dispatch.service';

/**
 * Public webhook receiver for external notification delivery statuses.
 * Per 17-THIRD-PARTY-INTEGRATIONS.md §3 & §5:
 * Provider webhooks update NoticeDelivery.status to DELIVERED/READ/FAILED asynchronously.
 */
@ApiTags('notice-webhooks')
@Controller('notices/webhooks')
export class NoticeWebhooksController {
  constructor(private readonly dispatchService: NoticeDispatchService) {}

  @Public()
  @Post('sendgrid')
  @HttpCode(200)
  @ApiOperation({ summary: 'SendGrid Event Webhook callback (delivery, bounce, open)' })
  async handleSendGridWebhook(@Body() events: any[]) {
    return this.dispatchService.handleSendGridWebhook(events);
  }

  @Public()
  @Get('whatsapp')
  @ApiOperation({ summary: 'Meta WhatsApp webhook verification challenge' })
  verifyWhatsAppWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    // Meta requires returning the challenge string in plaintext upon verification
    return challenge || 'OK';
  }

  @Public()
  @Post('whatsapp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Meta WhatsApp delivery & read receipt status webhook' })
  async handleWhatsAppWebhook(@Body() body: any) {
    return this.dispatchService.handleWhatsAppWebhook(body);
  }
}
