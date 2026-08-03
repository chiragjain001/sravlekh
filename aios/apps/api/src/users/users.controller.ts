import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole, UserStatus } from '@prisma/client';

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('institute/:instituteId')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all users in an institute' })
  findAll(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findAllByInstitute(instituteId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findById(id, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Admin: suspend or reactivate a user' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateStatus(id, dto.status, user);
  }
}
