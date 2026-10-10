import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus, TimetableExceptionType } from '@prisma/client';

export class MarkAttendanceEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studentProfileId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

// ── V4 Production Draft & Finalize DTOs ──────────────────────────────────────

export class SaveAttendanceDraftDto {
  @ApiProperty({ description: 'Optimistic concurrency version of the session', example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ type: [MarkAttendanceEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceEntryDto)
  entries!: MarkAttendanceEntryDto[];
}

export class FinalizeAttendanceDto {
  @ApiProperty({ description: 'Optimistic concurrency version of the session', example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CorrectAttendanceRecordDto {
  @ApiProperty({ description: 'Optimistic concurrency version of the session or record', example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiProperty({ minLength: 10, description: 'Mandatory reason for post-finalization correction' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class AdminOverrideSessionDto {
  @ApiProperty({ enum: ['CANCEL', 'UNCANCEL', 'FORCE_UNLOCK'] })
  @IsEnum(['CANCEL', 'UNCANCEL', 'FORCE_UNLOCK'])
  action!: 'CANCEL' | 'UNCANCEL' | 'FORCE_UNLOCK';

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class CreateTimetableExceptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  timetableSlotId!: string;

  @ApiProperty({ example: '2026-10-09', description: 'Source calendar date YYYY-MM-DD' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ enum: TimetableExceptionType })
  @IsEnum(TimetableExceptionType)
  type!: TimetableExceptionType;

  @ApiPropertyOptional({ description: 'Substitute teacher User ID' })
  @IsOptional()
  @IsString()
  substituteUserId?: string;

  @ApiPropertyOptional({ description: 'Target calendar date if cross-date rescheduled (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  targetDate?: string;

  @ApiPropertyOptional({ description: 'Adjusted UTC start time ISO string' })
  @IsOptional()
  @IsDateString()
  overrideStart?: string;

  @ApiPropertyOptional({ description: 'Adjusted UTC end time ISO string' })
  @IsOptional()
  @IsDateString()
  overrideEnd?: string;

  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class QueryTodaySessionsDto {
  @ApiPropertyOptional({ example: '2026-10-09' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherUserId?: string;
}

export class QueryStudentAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

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

// ── Legacy Compatibility DTOs (Preserved for Zero-Downtime Migration) ───────

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

export class UpdateAttendancePolicyDto {
  @ApiPropertyOptional({ example: 18, description: 'Daily cutoff hour (0-23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  cutoffHour?: number;

  @ApiPropertyOptional({ example: 15, description: 'Early-opening window before period in minutes (0-120)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  openBeforeMinutes?: number;

  @ApiPropertyOptional({ example: 30, description: 'Grace period buffer after period ends in minutes (0-180)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  gracePeriodMinutes?: number;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'Institute timezone (IANA string)' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: false, description: 'Allow standard teachers to correct historical records' })
  @IsOptional()
  @IsBoolean()
  allowTeacherHistoricalEdit?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Allow corrections on finalized records' })
  @IsOptional()
  @IsBoolean()
  allowFinalizedCorrection?: boolean;
}
