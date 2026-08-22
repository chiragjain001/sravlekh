import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdentityStatus } from '@prisma/client';

export class ConfirmIdentityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studentProfileId!: string;
}

export class QueryIdentityResolutionsDto {
  @ApiPropertyOptional({ enum: IdentityStatus, description: 'Defaults to PENDING — the mandatory-confirmation queue (30-IDENTITY-PAGE-MAPPING.md)' })
  @IsOptional()
  @IsEnum(IdentityStatus)
  status?: IdentityStatus;
}
