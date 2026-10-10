import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class CreatePermissionGrantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'REVIEW_EVALUATION' })
  @IsString()
  @IsNotEmpty()
  permission!: string;

  @ApiPropertyOptional({ description: 'Scope to one batch — omit for institute-wide' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Scope to one subject — omit for institute-wide' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class CreateBulkPermissionGrantsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ type: [String], example: ['ATTENDANCE_TAKE', 'ATTENDANCE_CORRECT'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({ description: 'Scope to one batch — omit for institute-wide' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Scope to one subject — omit for institute-wide' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class PermissionGrantItemDto {
  @ApiProperty({ example: 'ATTENDANCE_TAKE' })
  @IsString()
  @IsNotEmpty()
  permission!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class SyncUserPermissionsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ type: [PermissionGrantItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantItemDto)
  grants!: PermissionGrantItemDto[];
}

export class CreateCustomRoleDto {
  @ApiProperty({ example: 'Science Lab Coordinator' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.TEACHER })
  @IsEnum(UserRole)
  baseRole!: UserRole;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @ApiPropertyOptional({ enum: ['INSTITUTE', 'BATCH', 'SUBJECT'] })
  @IsOptional()
  @IsString()
  defaultScope?: 'INSTITUTE' | 'BATCH' | 'SUBJECT';
}

export class UpdateCustomRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ enum: ['INSTITUTE', 'BATCH', 'SUBJECT'] })
  @IsOptional()
  @IsString()
  defaultScope?: 'INSTITUTE' | 'BATCH' | 'SUBJECT';
}

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class SimulateAccessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class RevokeBulkGrantsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  grantIds!: string[];
}
