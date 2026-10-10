import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import {
  QueryLeaderboardDto,
  QueryGrowthLeaderboardDto,
} from './dto/leaderboard.dto';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('institutes/:instituteId/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Get exam score performance leaderboard (Rank Board)' })
  getRankLeaderboard(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryLeaderboardDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaderboardService.getRankLeaderboard(instituteId, query, actor);
  }

  @Get('growth')
  @Roles(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.FOUNDER)
  @ApiOperation({
    summary:
      'Get normalized growth & momentum leaderboard (Growth Board with ELO and Z-scores)',
  })
  getGrowthLeaderboard(
    @Param('instituteId') instituteId: string,
    @Query() query: QueryGrowthLeaderboardDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaderboardService.getGrowthLeaderboard(instituteId, query, actor);
  }
}
