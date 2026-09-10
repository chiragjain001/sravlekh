import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupportTicketsService } from './support-tickets.service';
import { CreateSupportTicketDto, AddTicketMessageDto } from './dto/support-ticket.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('support-tickets')
@ApiBearerAuth()
@Controller('institutes/:instituteId/support-tickets')
@Roles(UserRole.ADMIN, UserRole.FOUNDER)
export class SupportTicketsController {
  constructor(private readonly ticketsService: SupportTicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Raise a support ticket for this institute' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.create(instituteId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: "List this institute's support tickets" })
  findAll(@Param('instituteId') instituteId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.findAllForInstitute(instituteId, user);
  }

  @Get(':ticketId')
  @ApiOperation({ summary: 'Ticket detail with full message thread' })
  findOne(
    @Param('instituteId') instituteId: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.findOne(instituteId, ticketId, user);
  }

  @Post(':ticketId/messages')
  @ApiOperation({ summary: 'Reply on a ticket — reopens it if it was resolved/closed' })
  addMessage(
    @Param('instituteId') instituteId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: AddTicketMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.addMessage(instituteId, ticketId, dto, user);
  }
}
