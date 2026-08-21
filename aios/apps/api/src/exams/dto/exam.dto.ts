import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  Min,
  Max,
  MinLength,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ExamType, ExamStatus, CaptureMode, MistakeTagType } from '@prisma/client';

export class CreateExamDto {
  @ApiProperty({ example: 'Weekly Test 1' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  blueprintId!: string;

  @ApiProperty({ enum: ExamType })
  @IsEnum(ExamType)
  type!: ExamType;

  @ApiProperty({ enum: CaptureMode, default: CaptureMode.MANUAL_GRID })
  @IsEnum(CaptureMode)
  @IsOptional()
  captureMode?: CaptureMode = CaptureMode.MANUAL_GRID;

  @ApiPropertyOptional({ example: '2026-08-01T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venue?: string;
}

export class UpdateExamStatusDto {
  @ApiProperty({ enum: ExamStatus, description: 'Target status — must be exactly the next state in the sequence' })
  @IsEnum(ExamStatus)
  status!: ExamStatus;

  @ApiProperty({ description: 'The Exam.version this transition is based on — stale values are rejected with 409' })
  @IsNumber()
  @Min(0)
  version!: number;
}

export class UnlockExamDto {
  @ApiProperty({ description: 'Why this locked exam is being reopened — required, min 10 characters' })
  @IsString()
  @MinLength(10)
  reason!: string;

  @ApiProperty({ description: 'The Exam.version this transition is based on — stale values are rejected with 409' })
  @IsNumber()
  @Min(0)
  version!: number;
}

export class EvaluateResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  marksAwarded!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentAnswer?: string;

  @ApiPropertyOptional({ enum: MistakeTagType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MistakeTagType, { each: true })
  mistakeTags?: MistakeTagType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherComment?: string;
}

export class GradeAnswerSheetDto {
  @ApiProperty({ type: [EvaluateResponseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluateResponseDto)
  responses!: EvaluateResponseDto[];
}
