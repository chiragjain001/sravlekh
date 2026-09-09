import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { CreateNoticeDto, QueryNoticesDto } from './dto/notice.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('notices')
@ApiBearerAuth()
@Controller('institutes/:instituteId/notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Broadcast a notice across one or more channels' })
  createNotice(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateNoticeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.createNotice(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List notices sent in this institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryNoticesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.findAll(instituteId, query, user);
  }

  // Self-service inbox — any authenticated role, since every role can be a
  // notice recipient. Declared before the generic ':noticeId/...' routes
  // below share no path shape with 'mine', so no ordering ambiguity — kept
  // here for readability, grouped with the other reader-facing routes.
  @Get('mine')
  @ApiOperation({ summary: "The logged-in user's own IN_APP notifications" })
  getMyNotifications(
    @Param('instituteId') instituteId: string,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.getMyNotifications(instituteId, user, unreadOnly === 'true');
  }

  @Patch('mine/:deliveryId/read')
  @ApiOperation({ summary: 'Mark one of the logged-in user\'s own notifications as read' })
  markNotificationRead(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.markNotificationRead(instituteId, deliveryId, user);
  }

  @Patch('mine/read-all')
  @ApiOperation({ summary: "Mark all of the logged-in user's notifications as read" })
  markAllNotificationsRead(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.markAllNotificationsRead(instituteId, user);
  }

  @Get(':noticeId/delivery-report')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Per-recipient, per-channel delivery status for a notice' })
  getDeliveryReport(
    @Param('instituteId') instituteId: string,
    @Param('noticeId') noticeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.getDeliveryReport(instituteId, noticeId, user);
  }

  @Delete(':noticeId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Withdraw a notice and its per-recipient deliveries' })
  deleteNotice(
    @Param('instituteId') instituteId: string,
    @Param('noticeId') noticeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.noticesService.deleteNotice(instituteId, noticeId, user);
  }
}
