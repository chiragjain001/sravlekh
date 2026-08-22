import {
  IsString,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType } from '@prisma/client';

export class ReportScopeDto {
  @ApiPropertyOptional({ description: 'StudentProfile id — for student-scoped reports' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Batch id — for batch/class-scoped reports' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class CreateReportDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  type!: ReportType;

  @ApiProperty({ type: ReportScopeDto })
  @ValidateNested()
  @Type(() => ReportScopeDto)
  scope!: ReportScopeDto;

  @ApiPropertyOptional({ enum: ['PDF', 'EXCEL'], default: 'PDF' })
  @IsOptional()
  @IsString()
  format?: string = 'PDF';
}

export class QueryReportsDto {
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
