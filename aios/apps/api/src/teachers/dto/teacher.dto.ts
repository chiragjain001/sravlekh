import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsArray,
  IsEnum,
  MaxLength,
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
