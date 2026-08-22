import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/audit-log.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('institutes/:instituteId/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: "Read this institute's audit log (ADMIN: own tenant, FOUNDER: any)" })
  findAll(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.findAll(instituteId, query, user);
  }
}
