import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export enum InterventionFilterStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ALL = 'ALL',
}

export enum InterventionActionType {
  RESOLVE = 'RESOLVE',
  DISMISS = 'DISMISS',
  CONVERT_TO_EXTRA_CLASS = 'CONVERT_TO_EXTRA_CLASS',
}

export class QueryInterventionsDto {
  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by topic ID' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Filter by student profile ID' })
  @IsOptional()
  @IsString()
  studentProfileId?: string;

  @ApiPropertyOptional({ description: 'Filter by intervention type (e.g. ASSIGNMENT, EXTRA_CLASS)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: InterventionFilterStatus, default: InterventionFilterStatus.ACTIVE })
  @IsOptional()
  @IsEnum(InterventionFilterStatus)
  status?: InterventionFilterStatus = InterventionFilterStatus.ACTIVE;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class RemedialGroupQueryDto {
  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by subject ID' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class ActionInterventionDto {
  @ApiProperty({ enum: InterventionActionType })
  @IsEnum(InterventionActionType)
  action: InterventionActionType;

  @ApiPropertyOptional({ description: 'Teacher explanation or resolution note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'ISO date string when extra class is scheduled' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

