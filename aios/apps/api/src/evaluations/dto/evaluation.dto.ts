import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MistakeTagType } from '@prisma/client';

export enum EvaluationDecision {
  ACCEPT_AI = 'ACCEPT_AI',
  ADJUST = 'ADJUST',
  REJECT_RESCORE = 'REJECT_RESCORE',
}

export class CriterionScoreDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rubricCriterionId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  marksAwarded!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class DecideEvaluationDto {
  @ApiProperty({ enum: EvaluationDecision })
  @IsEnum(EvaluationDecision)
  decision!: EvaluationDecision;

  @ApiPropertyOptional({ description: 'Required for ADJUST/REJECT_RESCORE on a holistic (no rubric, or HOLISTIC_WITH_GUIDANCE) response' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  marksAwarded?: number;

  @ApiPropertyOptional({ type: [CriterionScoreDto], description: 'Required for ADJUST/REJECT_RESCORE on a CRITERION_ADDITIVE/STEP_WISE rubric response — total is always derived from these, never independently set (26 §4.2)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  criterionScores?: CriterionScoreDto[];

  @ApiPropertyOptional({ enum: MistakeTagType })
  @IsOptional()
  @IsEnum(MistakeTagType)
  mistakeTagType?: MistakeTagType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherComment?: string;
}

export class QueryEvaluationWorkItemsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'No AI-flagged items exist until Phase 13 (AI Evaluation) — accepted for forward compatibility, always returns empty today.' })
  @IsOptional()
  @IsString()
  aiFlag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
