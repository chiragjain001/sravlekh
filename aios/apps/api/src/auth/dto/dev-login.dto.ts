import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class DevLoginDto {
  @ApiProperty({ enum: UserRole, description: 'Role of the seeded dev user to sign in as' })
  @IsEnum(UserRole)
  role!: UserRole;
}
