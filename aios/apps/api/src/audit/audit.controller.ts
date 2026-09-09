import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/audit-log.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

/**
 * Live-update change feed. Separate route from /audit-logs because it is
 * readable by every role, whereas the audit log itself is ADMIN/FOUNDER only.
 */
@ApiTags('changes')
@ApiBearerAuth()
@Controller('institutes/:instituteId/changes')
export class ChangesController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Entity names changed in this institute since a timestamp (drives dashboard live refresh)' })
  getChanges(
    @Param('instituteId') instituteId: string,
    @Query('since') since: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auditService.getChangedEntities(instituteId, user, since);
  }
}

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
