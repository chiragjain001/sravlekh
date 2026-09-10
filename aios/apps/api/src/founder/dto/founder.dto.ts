import { IsEnum, IsOptional, IsString, IsBoolean, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutePlan } from '@prisma/client';

export class UpdateInstitutePlanDto {
  @ApiProperty({ enum: InstitutePlan })
  @IsEnum(InstitutePlan)
  plan!: InstitutePlan;

  @ApiPropertyOptional({ description: 'Why the plan is changing — stored in InstitutePlanHistory' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdatePlanDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStudents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxTeachers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStorageGb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAssessmentsPerMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  trialDurationDays?: number;
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

export class UpdatePlatformSettingsDto {
  @ApiProperty({
    description: 'Partial patch of platform-wide toggle settings — merged into the persisted set, never replaces it wholesale.',
    example: { maintMode: false, mfaEnforced: true },
  })
  @IsNotEmpty()
  patch!: Record<string, boolean>;
}
