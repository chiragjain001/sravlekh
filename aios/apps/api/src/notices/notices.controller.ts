import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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
}
