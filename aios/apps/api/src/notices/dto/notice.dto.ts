import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoticeChannel, UserRole } from '@prisma/client';

export class TargetAudienceDto {
  @ApiPropertyOptional({ enum: UserRole, isArray: true, description: 'Broadcast to everyone with these roles (ADMIN only — teachers cannot role-broadcast)' })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({ description: 'Notify every student in these batches' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];

  @ApiPropertyOptional({ description: 'Notify these specific students (StudentProfile ids)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}

export class CreateNoticeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({ enum: NoticeChannel, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(NoticeChannel, { each: true })
  channels!: NoticeChannel[];

  @ApiProperty({ type: TargetAudienceDto })
  @ValidateNested()
  @Type(() => TargetAudienceDto)
  targetAudience!: TargetAudienceDto;
}

export class QueryNoticesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
