import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsArray, ValidateNested, Min, IsIn, Equals, IsBoolean, MaxLength, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MistakeTagType } from '@prisma/client';
import { CriterionScoreDto } from './evaluation.dto';

export const VERDICTS = ['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT', 'NOT_ATTEMPTED'] as const;
export type Verdict = (typeof VERDICTS)[number];

export class TagMarkDto {
  @ApiProperty({ example: 'FORMULA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  tag!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  marksAwarded!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CheckedCopyItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  responseId!: string;

  @ApiPropertyOptional({ description: 'Required when neither tags nor criterionScores are given. When tags are given it must equal their sum (or be omitted).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  marksAwarded?: number;

  @ApiPropertyOptional({ type: [TagMarkDto], description: 'Tag-wise split for a question without an additive rubric; the total is derived from these.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => TagMarkDto)
  tags?: TagMarkDto[];

  @ApiPropertyOptional({ type: [CriterionScoreDto], description: 'Required for a CRITERION_ADDITIVE/STEP_WISE rubric question.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  criterionScores?: CriterionScoreDto[];

  @ApiPropertyOptional({ enum: VERDICTS, description: 'Derived from the marks when omitted.' })
  @IsOptional()
  @IsIn(VERDICTS as unknown as string[])
  verdict?: Verdict;

  @ApiPropertyOptional({ enum: MistakeTagType })
  @IsOptional()
  @IsEnum(MistakeTagType)
  mistakeTagType?: MistakeTagType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherComment?: string;
}

export class SubmitCheckedCopyDto {
  @ApiProperty({ description: 'The teacher ticked "I have checked every answer" — the submit is refused without it.' })
  @IsBoolean()
  @Equals(true, { message: 'Confirm that you have checked every answer before submitting.' })
  confirmed!: boolean;

  @ApiProperty({ type: [CheckedCopyItemDto], description: 'One entry per subjective answer on this sheet — all of them, not just the edited ones.' })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CheckedCopyItemDto)
  items!: CheckedCopyItemDto[];
}
