import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RubricScoringMode } from '@prisma/client';

export class RubricCriterionDto {
  @ApiProperty({ example: "Correctly identifies chlorophyll's role" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywordHints?: string[];

  @ApiPropertyOptional({
    description:
      '0-based index of another criterion IN THIS SAME REQUEST that this one depends on (STEP_WISE mode). ' +
      'Real RubricCriterion IDs do not exist yet at authoring time, so this refers to array position, not a persisted ID.',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dependsOnCriterionIndex?: number;
}

export class CreateRubricDto {
  @ApiProperty({ example: 'Photosynthesis explanation — 5 mark rubric' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: RubricScoringMode })
  @IsEnum(RubricScoringMode)
  scoringMode!: RubricScoringMode;

  @ApiProperty({ type: [RubricCriterionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria!: RubricCriterionDto[];
}

export class UpdateRubricDto {
  @ApiPropertyOptional({ enum: RubricScoringMode, description: 'Omit to keep the current scoring mode' })
  @IsOptional()
  @IsEnum(RubricScoringMode)
  scoringMode?: RubricScoringMode;

  @ApiProperty({ type: [RubricCriterionDto], description: 'The full replacement criteria list for the new version' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria!: RubricCriterionDto[];
}
