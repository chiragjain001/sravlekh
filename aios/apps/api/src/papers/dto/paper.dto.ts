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
