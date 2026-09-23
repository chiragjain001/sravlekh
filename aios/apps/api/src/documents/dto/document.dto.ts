import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum, IsNumber, Max, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProcessingStage, RegionType } from '@prisma/client';

export class CreateDocumentBundleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assessmentDeliveryId!: string;

  @ApiPropertyOptional({ example: 40, description: 'e.g. "40 booklets for Class 10-A" — used for completeness validation' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedDocumentCount?: number;
}

export class ReprocessDocumentDto {
  @ApiProperty({ enum: ProcessingStage })
  @IsEnum(ProcessingStage)
  fromStage!: ProcessingStage;
}

export class BoundingBoxDto {
  @ApiProperty({ description: 'Normalized 0.0–1.0 coordinates, resolution-independent' })
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  width!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  height!: number;
}

export class CreatePageRegionDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  boundingBox!: BoundingBoxDto;

  @ApiProperty({ enum: RegionType })
  @IsEnum(RegionType)
  regionType!: RegionType;

  @ApiPropertyOptional({ description: 'Set only for regionType=QUESTION_ANSWER — makes this a QuestionRegion' })
  @IsOptional()
  @IsString()
  questionId?: string;
}

export class UpdatePageRegionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  boundingBox?: BoundingBoxDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiPropertyOptional({
    description:
      'Re-mapping a region to a different question discards the marks recorded against the old one. ' +
      'Required (true) when those marks were already confirmed by a teacher.',
  })
  @IsOptional()
  @IsBoolean()
  discardMarks?: boolean;
}
