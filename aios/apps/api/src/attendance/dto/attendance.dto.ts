import {
  IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsDateString,
  ValidateNested, MinLength, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { IsInt, Min, Max } from 'class-validator';

export class MarkAttendanceEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studentProfileId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

export class MarkAttendanceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @ApiProperty({ example: '2026-08-24' })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [MarkAttendanceEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceEntryDto)
  entries!: MarkAttendanceEntryDto[];
}

export class CorrectAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class QueryAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentProfileId?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 30;
}

export class QueryAttendanceSummaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
