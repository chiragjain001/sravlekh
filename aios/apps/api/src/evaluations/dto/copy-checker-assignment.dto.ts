import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentScope } from '@prisma/client';

export class CreateCopyCheckerAssignmentDto {
  @ApiProperty({ description: 'ID of the teacher profile being assigned as copy-checker' })
  @IsString()
  @IsNotEmpty()
  teacherProfileId!: string;

  @ApiPropertyOptional({
    description: 'Scope of assignment: BATCH (all students), STUDENT_LIST, or QUESTION_WISE',
    enum: AssignmentScope,
    default: AssignmentScope.BATCH,
  })
  @IsOptional()
  @IsEnum(AssignmentScope)
  scope?: AssignmentScope = AssignmentScope.BATCH;

  @ApiPropertyOptional({ description: 'Whether this evaluator has lead/moderator privileges for finalization' })
  @IsOptional()
  @IsBoolean()
  isLeadEvaluator?: boolean = false;

  @ApiPropertyOptional({
    description: 'Array of studentProfileIds when scope is STUDENT_LIST',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentProfileIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of questionIds when scope is QUESTION_WISE',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionIds?: string[];
}

export class BulkAssignEvaluatorsDto {
  @ApiProperty({ type: [CreateCopyCheckerAssignmentDto] })
  @IsArray()
  assignments!: CreateCopyCheckerAssignmentDto[];
}
