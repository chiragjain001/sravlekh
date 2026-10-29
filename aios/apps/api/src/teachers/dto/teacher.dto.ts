import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsArray,
  IsEnum,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'Dr. Priya Mehta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'teacher@institute.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'M.Sc Physics, IIT Bombay' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @ApiPropertyOptional({
    description: 'Subject IDs the teacher is qualified to teach',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({
    description: 'Batch IDs the teacher is initially assigned to teach',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}

export class UpdateTeacherDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}

export class UpdateMyProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;
}

export class AssignBatchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @ApiPropertyOptional({ description: 'Subject ID the teacher handles for this batch' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export const TEACHER_SORT_FIELDS = ['name', 'qualification'] as const;
export type TeacherSortField = (typeof TEACHER_SORT_FIELDS)[number];

export class QueryTeachersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], description: 'Filter by account status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: TEACHER_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsEnum(TEACHER_SORT_FIELDS)
  sortBy?: TeacherSortField = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'asc';

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

export class BulkTeacherRowDto {
  @ApiProperty({ example: 'Dr. Priya Mehta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'priya.mehta@school.edu' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'M.Sc Physics, B.Ed' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @ApiPropertyOptional({ example: 'Physics' })
  @IsOptional()
  @IsString()
  subjectName?: string;

  @ApiPropertyOptional({ example: 'subj-101' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'Class 10 - Section A' })
  @IsOptional()
  @IsString()
  batchName?: string;

  @ApiPropertyOptional({ example: 'batch-101' })
  @IsOptional()
  @IsString()
  batchId?: string;
}

export class BulkCommitTeachersDto {
  @ApiProperty({ type: [BulkTeacherRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkTeacherRowDto)
  teachers!: BulkTeacherRowDto[];
}

