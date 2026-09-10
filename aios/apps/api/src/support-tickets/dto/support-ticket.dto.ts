import { IsEnum, IsOptional, IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client';

export class CreateSupportTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;
}

export class AddTicketMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}

export class UpdateTicketPriorityDto {
  @ApiProperty({ enum: SupportTicketPriority })
  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}

export class AssignTicketDto {
  @ApiProperty({ description: 'User id to assign the ticket to' })
  @IsString()
  @IsNotEmpty()
  assignedToUserId!: string;
}

export class QueryTicketsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instituteId?: string;

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
  pageSize?: number = 20;
}
