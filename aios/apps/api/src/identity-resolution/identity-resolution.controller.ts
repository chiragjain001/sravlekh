import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IdentityResolutionService } from './identity-resolution.service';
import { ConfirmIdentityDto, QueryIdentityResolutionsDto } from './dto/identity-resolution.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('identity-resolution')
@ApiBearerAuth()
@Controller('institutes/:instituteId/identity-resolutions')
export class IdentityResolutionController {
  constructor(private readonly identityResolutionService: IdentityResolutionService) {}

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Queue of documents awaiting manual identity confirmation (30-IDENTITY-PAGE-MAPPING.md)' })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryIdentityResolutionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.identityResolutionService.findAll(instituteId, query, user);
  }

  @Post(':resolutionId/confirm')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Confirm or correct the student a scanned document belongs to' })
  confirm(
    @Param('instituteId') instituteId: string,
    @Param('resolutionId') resolutionId: string,
    @Body() dto: ConfirmIdentityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.identityResolutionService.confirm(instituteId, resolutionId, dto, user);
  }
}
