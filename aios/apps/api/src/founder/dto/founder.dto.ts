import { IsEnum, IsOptional, IsString, IsBoolean, IsNotEmpty, IsInt, Min, IsNumber, IsObject } from 'class-validator';
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

export class UpdateInstituteModulesDto {
  @ApiPropertyOptional({ example: 'EXAM_OMR' })
  @IsOptional()
  @IsString()
  preset?: string;

  @ApiProperty({ description: 'Map of module keys to enabled boolean' })
  @IsObject()
  @IsNotEmpty()
  modules!: Record<string, boolean>;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Target institute ID' })
  @IsString()
  @IsNotEmpty()
  instituteId!: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 'ANNUAL' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packagePreset?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ example: 'UPI' })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiPropertyOptional({ example: 'UPI-REF-987213645' })
  @IsOptional()
  @IsString()
  transactionRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RetryQueueJobsDto {
  @ApiPropertyOptional({ example: 'ai-evaluation' })
  @IsOptional()
  @IsString()
  queueName?: string;
}

export class FlushCacheDto {
  @ApiPropertyOptional({ description: 'Optional institute ID to flush' })
  @IsOptional()
  @IsString()
  instituteId?: string;

  @ApiPropertyOptional({ description: 'True to flush global application cache' })
  @IsOptional()
  @IsBoolean()
  global?: boolean;
}

