import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InterventionsService } from './interventions.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import {
  QueryInterventionsDto,
  RemedialGroupQueryDto,
  ActionInterventionDto,
} from './dto/intervention.dto';

@ApiTags('interventions')
@ApiBearerAuth()
@Controller('institutes/:instituteId/interventions')
export class InterventionsController {
  constructor(private readonly interventionsService: InterventionsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  @ApiOperation({ summary: 'List academic interventions with status & topic filters' })
  @ApiResponse({ status: 200, description: 'Interventions retrieved successfully' })
  listInterventions(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryInterventionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interventionsService.listInterventions(instituteId, query, user);
  }

  @Get('remedial-groups')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get extra-class student groupings based on common weak topics' })
  @ApiResponse({ status: 200, description: 'Remedial extra-class groupings calculated successfully' })
  getRemedialGroups(
    @Param('instituteId') instituteId: string,
    @Query() query: RemedialGroupQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interventionsService.getRemedialGroups(instituteId, query, user);
  }

  @Post(':id/action')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Review, resolve, dismiss, or schedule an extra class for an intervention' })
  @ApiResponse({ status: 200, description: 'Intervention action recorded successfully' })
  actionIntervention(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() dto: ActionInterventionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interventionsService.actionIntervention(instituteId, id, dto, user);
  }
}

