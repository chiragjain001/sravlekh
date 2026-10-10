import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuestionType,
  DifficultyLevel,
  BloomsTaxonomyLevel,
  QuestionVariantType,
  QuestionSourceType,
  QuestionStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';

export class CreateQuestionDto {
  @ApiProperty({ description: 'ID of the Subject' })
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @ApiProperty({ description: 'ID of the Chapter' })
  @IsString()
  @IsNotEmpty()
  chapterId!: string;

  @ApiProperty({ description: 'ID of the Topic' })
  @IsString()
  @IsNotEmpty()
  topicId!: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty({ enum: DifficultyLevel })
  @IsEnum(DifficultyLevel)
  difficulty!: DifficultyLevel;

  @ApiProperty({ example: 4.0 })
  @IsNumber()
  @Min(0)
  marks!: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarks?: number;

  @ApiProperty({ description: 'Markdown or LaTeX content of the question' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'JSON structure for options (e.g., for MCQs)' })
  @IsOptional()
  options?: any;

  @ApiPropertyOptional({ description: 'Detailed solution or explanation' })
  @IsOptional()
  @IsString()
  solution?: string;

  @ApiPropertyOptional({ description: 'Source or textbook reference' })
  @IsOptional()
  @IsString()
  sourceRef?: string;

  @ApiPropertyOptional({ enum: BloomsTaxonomyLevel })
  @IsOptional()
  @IsEnum(BloomsTaxonomyLevel)
  bloomsLevel?: BloomsTaxonomyLevel;

  @ApiPropertyOptional({ enum: QuestionSourceType })
  @IsOptional()
  @IsEnum(QuestionSourceType)
  sourceType?: QuestionSourceType;

  @ApiPropertyOptional({ description: 'Detailed source metadata (edition, chapter, page, year)' })
  @IsOptional()
  sourceDetails?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Estimated time to answer in seconds', example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expectedTimeSec?: number;

  @ApiPropertyOptional({ description: 'Language code', default: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Question family ID for variants' })
  @IsOptional()
  @IsString()
  familyId?: string;

  @ApiPropertyOptional({ description: 'Parent question ID if this is a variant' })
  @IsOptional()
  @IsString()
  parentQuestionId?: string;

  @ApiPropertyOptional({ enum: QuestionVariantType })
  @IsOptional()
  @IsEnum(QuestionVariantType)
  variantType?: QuestionVariantType;

  @ApiPropertyOptional({ description: 'Mapped concept IDs', type: [String] })
  @IsOptional()
  @IsArray()
  conceptIds?: string[];

  @ApiPropertyOptional({ description: 'Mapped learning objective IDs', type: [String] })
  @IsOptional()
  @IsArray()
  learningObjectiveIds?: string[];

  @ApiPropertyOptional({ description: 'Extensible payload for Visual, CS/Code, or Case Study questions' })
  @IsOptional()
  typePayload?: any;

  @ApiPropertyOptional({ description: 'Grade level ID' })
  @IsOptional()
  @IsString()
  gradeLevelId?: string;

  @ApiPropertyOptional({ description: 'Curriculum version ID' })
  @IsOptional()
  @IsString()
  curriculumVersionId?: string;
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  marks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  options?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  solution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceRef?: string;
}

export class QueryQuestionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chapterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: BloomsTaxonomyLevel })
  @IsOptional()
  @IsEnum(BloomsTaxonomyLevel)
  bloomsLevel?: BloomsTaxonomyLevel;

  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({ enum: QuestionSourceType })
  @IsOptional()
  @IsEnum(QuestionSourceType)
  sourceType?: QuestionSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  familyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conceptId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeLevelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  // `@Type(() => Boolean)` calls JS's `Boolean(value)`, which is `true` for
  // *any* non-empty string — so `?isApproved=false` would coerce to `true`
  // and the "pending approval" filter would silently return approved
  // questions instead. Compare the raw query string explicitly.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
