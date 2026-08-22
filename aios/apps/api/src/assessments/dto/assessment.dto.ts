import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsDateString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssessmentKind, StakesLevel, ExamStatus } from '@prisma/client';

export class CreateAssessmentDto {
  @ApiProperty({ example: 'Weekly Test 1' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: AssessmentKind })
  @IsEnum(AssessmentKind)
  assessmentKind!: AssessmentKind;

  @ApiProperty({ enum: StakesLevel, description: '04-DATABASE-SCHEMA.md (V2 section) fix #3: gates AI-final-scoring eligibility, independent of assessmentKind' })
  @IsEnum(StakesLevel)
  stakesLevel!: StakesLevel;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  subjectIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paperId?: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  totalMarks!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeLevel?: string;
}

export class CreateAssessmentDeliveryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @ApiPropertyOptional({ example: '2026-08-01T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @ApiPropertyOptional({ example: '2026-08-01T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  captureProviderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  evaluationPolicyId!: string;
}

export class UpdateAssessmentDeliveryStatusDto {
  @ApiProperty({ enum: ExamStatus, description: 'Target status — must be exactly the next state in the sequence' })
  @IsEnum(ExamStatus)
  status!: ExamStatus;

  @ApiProperty({ description: 'The AssessmentDelivery.version this transition is based on — stale values are rejected with 409' })
  @IsNumber()
  @Min(0)
  version!: number;
}

export class UnlockAssessmentDeliveryDto {
  @ApiProperty({ description: 'Why this locked delivery is being reopened — required, min 10 characters' })
  @IsString()
  @MinLength(10)
  reason!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  version!: number;
}
