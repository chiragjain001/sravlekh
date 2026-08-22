import { IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationPolicyMode } from '@prisma/client';

export class CreateEvaluationPolicyDto {
  @ApiProperty({ example: 'Standard manual review' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: EvaluationPolicyMode })
  @IsEnum(EvaluationPolicyMode)
  mode!: EvaluationPolicyMode;

  @ApiPropertyOptional({ description: 'Defaults to true for every mode except AUTOMATIC/AI_FINAL_LOW_STAKES' })
  @IsOptional()
  @IsBoolean()
  requiresHumanReview?: boolean;
}
