import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsEnum,
  ArrayMinSize,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutePlan } from '@prisma/client';

export class CreateInstituteDto {
  @ApiProperty({ example: 'Sunrise Coaching Institute' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    description: 'Approved email domains or exact emails for the allow-list',
    example: ['@sunrisecoaching.com', 'admin@gmail.com'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  domainAllowlist!: string[];

  @ApiPropertyOptional({ enum: InstitutePlan })
  @IsOptional()
  @IsEnum(InstitutePlan)
  plan?: InstitutePlan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateInstituteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domainAllowlist?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class AddAllowListEntryDto {
  @ApiProperty({ example: 'teacher@sunrisecoaching.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['STUDENT', 'TEACHER', 'ADMIN'] })
  @IsString()
  @IsNotEmpty()
  role!: string;
}
