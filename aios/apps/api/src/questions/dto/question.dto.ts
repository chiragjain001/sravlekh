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
import { QuestionType, DifficultyLevel } from '@prisma/client';
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
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
