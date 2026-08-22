import { IsEnum, IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutePlan } from '@prisma/client';

export class UpdateInstitutePlanDto {
  @ApiProperty({ enum: InstitutePlan })
  @IsEnum(InstitutePlan)
  plan!: InstitutePlan;
}

export class UpdateFeatureFlagDto {
  @ApiProperty({ description: 'Institute to toggle the flag for' })
  @IsString()
  @IsNotEmpty()
  instituteId!: string;

  @ApiProperty({ example: 'omrCapture' })
  @IsString()
  @IsNotEmpty()
  flag!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class QueryInstitutesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
