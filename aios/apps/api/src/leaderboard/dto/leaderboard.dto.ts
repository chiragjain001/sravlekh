import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum LeaderboardScope {
  CLASS = 'class',
  BATCH = 'batch',
}

export enum ExamFamilyFilter {
  ALL = 'ALL',
  SPOT = 'SPOT',
  PERIODIC = 'PERIODIC',
  MAJOR = 'MAJOR',
}

export class QueryLeaderboardDto {
  @ApiPropertyOptional({ enum: LeaderboardScope, default: LeaderboardScope.CLASS })
  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope?: LeaderboardScope = LeaderboardScope.CLASS;

  @ApiPropertyOptional({ description: 'Filter by specific batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific exam ID' })
  @IsOptional()
  @IsString()
  examId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific subject ID' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class QueryGrowthLeaderboardDto {
  @ApiPropertyOptional({ enum: LeaderboardScope, default: LeaderboardScope.CLASS })
  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope?: LeaderboardScope = LeaderboardScope.CLASS;

  @ApiPropertyOptional({ description: 'Filter by specific batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by subject ID or "all"' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ enum: ExamFamilyFilter, default: ExamFamilyFilter.ALL })
  @IsOptional()
  @IsEnum(ExamFamilyFilter)
  examFamily?: ExamFamilyFilter = ExamFamilyFilter.ALL;

  @ApiPropertyOptional({ description: 'Time window in weeks (e.g. 4, 8, 52)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104)
  periodWeeks?: number;
}
