import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CaptureProvidersService } from './capture-providers.service';
import { CreateCaptureProviderDto } from './dto/capture-provider.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('capture-providers')
@ApiBearerAuth()
@Controller('institutes/:instituteId/capture-providers')
export class CaptureProvidersController {
  constructor(private readonly captureProvidersService: CaptureProvidersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Register a capture provider (29-CAPTURE-PROVIDER-ARCHITECTURE.md)' })
  create(
    @Param('instituteId') instituteId: string,
    @Body() dto: CreateCaptureProviderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.captureProvidersService.create(instituteId, dto, user);
  }

  @Get()
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List capture providers for this institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.captureProvidersService.findAll(instituteId, user);
  }
}
