import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimetableSlotType } from '@prisma/client';

export class CreateTimetableSlotDto {
  @ApiPropertyOptional({ description: 'Batch ID if this is for a specific batch' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiProperty({ enum: TimetableSlotType })
  @IsEnum(TimetableSlotType)
  type!: TimetableSlotType;

  @ApiProperty({ example: 'Physics Final Review' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'ID of the teacher conducting the slot' })
  @IsOptional()
  @IsString()
  teacherUserId?: string;

  @ApiPropertyOptional({ description: 'Subject ID' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Room / Venue reference' })
  @IsOptional()
  @IsString()
  roomRef?: string;

  @ApiProperty({ example: '2026-08-01T10:00:00Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-08-01T11:00:00Z' })
  @IsDateString()
  endTime!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean = false;

  @ApiPropertyOptional({ description: 'iCal RRULE string if isRecurring is true' })
  @IsOptional()
  @IsString()
  recurRule?: string;
}

export class QueryTimetableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateEnd?: string;
}
