import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBatchDto {
  @ApiProperty({ example: 'JEE Advanced 2026 — Batch A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Class 11' })
  @IsOptional()
  @IsString()
  classYear?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ example: '2025-2026' })
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classYear?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSubjectDto {
  @ApiProperty({ example: 'Physics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'PHY' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;
}

export class CreateChapterDto {
  @ApiProperty({ example: 'Kinematics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  order?: number;
}

export class CreateTopicDto {
  @ApiProperty({ example: 'Projectile Motion' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  order?: number;
}

export class UpdateSubjectDto {
  @ApiPropertyOptional({ example: 'Physics' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'PHY' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;
}

export class UpdateChapterDto {
  @ApiPropertyOptional({ example: 'Kinematics' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  order?: number;
}

export class UpdateTopicDto {
  @ApiPropertyOptional({ example: 'Projectile Motion' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  order?: number;
}
