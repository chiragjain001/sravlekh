import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TimetableService } from './timetable.service';
import {
  CreateTimetableSlotDto,
  QueryTimetableDto,
} from './dto/timetable.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('timetable')
@ApiBearerAuth()
@Controller('institutes/:instituteId/timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Post()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a new timetable slot' })
  createSlot(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateTimetableSlotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.createSlot(instituteId, dto, user);
  }

  @Delete(':slotId')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Remove a timetable slot (cancelled or mis-scheduled class)' })
  deleteSlot(
    @Param('instituteId') instituteId: string,
    @Param('slotId') slotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.deleteSlot(instituteId, slotId, user);
  }

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List timetable slots' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryTimetableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.findAll(instituteId, query, user);
  }
}
