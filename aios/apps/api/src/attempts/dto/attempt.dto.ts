import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MistakeTagType } from '@prisma/client';

/**
 * Same shape as v1's EvaluateResponseDto (exams/dto/exam.dto.ts) — deliberate:
 * see AttemptsService's module comment for why. Caller supplies marksAwarded
 * directly; there is no auto-grading engine to invoke here that v1 didn't
 * already lack.
 */
export class CaptureResponseDto {
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
}

export class CreateAttemptDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assessmentDeliveryId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studentProfileId!: string;

  @ApiProperty({ description: 'May differ from the delivery default — 29-CAPTURE-PROVIDER-ARCHITECTURE.md §4 cross-mode entry' })
  @IsString()
  @IsNotEmpty()
  captureProviderId!: string;

  @ApiPropertyOptional({
    type: [CaptureResponseDto],
    description: 'Structured capture payload, present for OMR/MANUAL_GRID/CSV_IMPORT/PHOTO_CAPTURE_OBJECTIVE. Omit for PHOTO_CAPTURE_SUBJECTIVE, which ingests asynchronously via the document pipeline (Phase 10, not yet built).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaptureResponseDto)
  responses?: CaptureResponseDto[];
}
