import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsDateString,
  IsArray,
  IsEnum,
  MinLength,
  MaxLength,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

// Allowed student tag values — defined as a const for reuse in service-level validation
export const STUDENT_TAG_VALUES = [
  'fast-learner',
  'concept-weak',
  'needs-revision',
  'high-risk',
  'inconsistent',
  'absentee-sensitive',
  'exam-anxiety',
  'ready-for-hard-paper',
] as const;

export type StudentTag = (typeof STUDENT_TAG_VALUES)[number];

export class CreateStudentDto {
  @ApiProperty({ example: 'Aditya Sharma' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'student@institute.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'JEE2026-101' })
  @IsOptional()
  @IsString()
  rollNumber?: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Ramesh Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional({ example: 'guardian@email.com' })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({ example: '123 Main St, Mumbai' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'ID of the batch to enrol the student in' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({
    enum: STUDENT_TAG_VALUES,
    isArray: true,
    example: ['high-risk', 'needs-revision'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateStudentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class TransferBatchDto {
  @ApiProperty({ description: 'Target batch ID for the transfer' })
  @IsString()
  @IsNotEmpty()
  targetBatchId!: string;

  @ApiPropertyOptional({ description: 'Reason for batch transfer (stored in history)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateTagsDto {
  @ApiProperty({
    enum: STUDENT_TAG_VALUES,
    isArray: true,
    description: 'Full replacement of student tags',
  })
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}

export class QueryStudentsDto {
  @ApiPropertyOptional({ example: 'Aditya' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by batch ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({
    enum: STUDENT_TAG_VALUES,
    isArray: true,
    description: 'Filter by one or more tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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
