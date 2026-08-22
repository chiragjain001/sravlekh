import { IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CaptureProviderType } from '@prisma/client';

export class CreateCaptureProviderDto {
  @ApiProperty({ enum: CaptureProviderType })
  @IsEnum(CaptureProviderType)
  type!: CaptureProviderType;

  @ApiProperty({ description: 'Shape depends on type — see 29-CAPTURE-PROVIDER-ARCHITECTURE.md §6', example: {} })
  @IsObject()
  config!: Record<string, unknown>;
}
