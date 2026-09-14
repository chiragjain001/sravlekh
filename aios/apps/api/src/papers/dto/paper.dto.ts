import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DifficultyLevel, QuestionType } from '@prisma/client';

export class BlueprintDistributionRuleDto {
  @ApiProperty({ description: 'ID of the Topic to pull questions from' })
  @IsString()
  @IsNotEmpty()
  topicId!: string;

  @ApiProperty({ enum: QuestionType })
  @IsString()
  @IsNotEmpty()
  type!: QuestionType;

  @ApiProperty({ enum: DifficultyLevel })
  @IsString()
  @IsNotEmpty()
  difficulty!: DifficultyLevel;

  @ApiProperty({ description: 'Number of questions to pick for this rule', example: 5 })
  @IsNumber()
  @Min(1)
  count!: number;

  @ApiProperty({ description: 'Marks per question for this rule', example: 4 })
  @IsNumber()
  @Min(1)
  marksPerQuestion!: number;
}

export class CreateBlueprintDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @ApiProperty({ example: 'JEE Mains Math 2026 Blueprint' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 300 })
  @IsNumber()
  @Min(1)
  totalMarks!: number;

  @ApiProperty({ example: 180, description: 'Duration in minutes' })
  @IsNumber()
  @Min(1)
  duration!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiProperty({ type: [BlueprintDistributionRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintDistributionRuleDto)
  distribution!: BlueprintDistributionRuleDto[];
}

export class GeneratePaperDto {
  @ApiProperty({ description: 'ID of the Blueprint to use for generation' })
  @IsString()
  @IsNotEmpty()
  blueprintId!: string;

  @ApiProperty({ example: 'Mock Test 1' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Generate personalized paper targeting specific student weaknesses' })
  @IsOptional()
  @IsString()
  targetStudentId?: string;

  @ApiPropertyOptional({ description: 'Target batch for the paper' })
  @IsOptional()
  @IsString()
  targetBatchId?: string;
}

/**
 * POST papers/:paperId/clone — copies a reviewed paper's exact items into a
 * fresh Paper for one target batch.
 *
 * WHY THIS EXISTS: Paper.examId is a single scalar (one paper links to at most
 * one exam), so a paper reviewed once cannot be linked to several batches'
 * exams directly — the second link-paper call would silently steal it from
 * the first. Publishing to N batches from one reviewed paper therefore clones
 * it N times, item-for-item, rather than re-drawing from the blueprint — so
 * every batch gets exactly what the teacher approved, not a fresh random pick
 * that happens to share a blueprint.
 */
export class ClonePaperDto {
  @ApiProperty({ example: 'Physics Weekly Test — Class 10A' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Batch this clone is being published to' })
  @IsOptional()
  @IsString()
  targetBatchId?: string;
}

/**
 * PATCH papers/:paperId/items/:itemId/manual — a teacher writes their own
 * replacement question instead of accepting a regenerated one.
 *
 * Everything but `content` is optional and defaults to the item being
 * replaced (topic, chapter, subject, type, difficulty, marks) — the teacher
 * is filling one slot in an already-scoped paper, not authoring a bank entry
 * from scratch, so only the fields they're actually changing should need
 * typing.
 */
export class ManualReplaceItemDto {
  @ApiProperty({ description: 'The question text the teacher wrote' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ enum: DifficultyLevel, description: 'Defaults to the replaced question\'s difficulty' })
  @IsOptional()
  @IsString()
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ enum: QuestionType, description: 'Defaults to the replaced question\'s type' })
  @IsOptional()
  @IsString()
  type?: QuestionType;

  @ApiPropertyOptional({ description: 'Defaults to the paper item\'s current marks' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  marks?: number;

  @ApiPropertyOptional({ description: 'MCQ-style options — array of {label, text, isCorrect}' })
  @IsOptional()
  options?: unknown;

  @ApiPropertyOptional({ description: 'Explanation shown after grading, optional' })
  @IsOptional()
  @IsString()
  solution?: string;
}
