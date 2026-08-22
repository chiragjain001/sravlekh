import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
