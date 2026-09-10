import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ description: 'Filter by the acting User id' })
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Entity table name, e.g. "exams"' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

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

// A real class (not `QueryAuditLogsDto & { instituteId?: string }`) so Nest's
// reflected parameter metadata still resolves to a class ValidationPipe can
// run class-transformer against — an inline intersection type erases to
// `Object` at the metadata level, which makes ValidationPipe silently skip
// transformation, leaving page/pageSize as raw query-string values and
// crashing Prisma's `take` with a string instead of a number.
export class QueryFounderAuditLogsDto extends QueryAuditLogsDto {
  @ApiPropertyOptional({ description: 'Restrict to one institute; omit for every institute' })
  @IsOptional()
  @IsString()
  instituteId?: string;
}
