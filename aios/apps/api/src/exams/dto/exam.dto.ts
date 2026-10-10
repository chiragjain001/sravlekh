import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  IsInt,
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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  blueprintId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalMarks?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ example: 'OFFLINE_PRINT' })
  @IsOptional()
  @IsString()
  deliveryMode?: string;

  @ApiPropertyOptional({ enum: ExamStatus })
  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;
}

export class SelectOfficialPaperDto {
  @ApiProperty({ description: 'ID of the Candidate Paper selected as the official paper' })
  @IsString()
  @IsNotEmpty()
  paperId!: string;

  @ApiPropertyOptional({ description: 'Optional feedback / review comment' })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class RejectCandidatePaperDto {
  @ApiPropertyOptional({ description: 'Reason for rejecting this candidate paper' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RequestChangesDto {
  @ApiProperty({ description: 'Feedback on what changes are needed before this paper can be approved' })
  @IsString()
  @IsNotEmpty()
  feedback!: string;
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

export class ListExamsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ enum: ExamStatus, description: 'Filter by exam status' })
  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;

  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;
}
