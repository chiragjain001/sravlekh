import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DoubtStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateDoubtDto {
  @ApiProperty({ description: 'ID of the Subject' })
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @ApiPropertyOptional({ description: 'Optional Topic ID for specific doubts' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Urgency: 1 (Low), 2 (Medium), 3 (High)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  urgency?: number = 1;

  @ApiProperty({ description: 'Description of the doubt' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'Array of image/document URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}

export class AssignDoubtDto {
  @ApiProperty({ description: 'User ID of the teacher to assign' })
  @IsString()
  @IsNotEmpty()
  teacherUserId!: string;
}

export class ResolveDoubtDto {
  @ApiProperty({ description: 'Resolution explanation or answer' })
  @IsString()
  @IsNotEmpty()
  resolutionText!: string;
}

export class QueryDoubtsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  studentProfileId?: string;

  @ApiPropertyOptional({ enum: DoubtStatus })
  @IsOptional()
  @IsEnum(DoubtStatus)
  status?: DoubtStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
