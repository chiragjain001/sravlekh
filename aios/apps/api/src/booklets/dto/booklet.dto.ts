import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePrintRunDto {
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  count!: number;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(10)
  @Type(() => Number)
  maxRollDigits?: number;
}

export class VoidBookletDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class VerifyBookletQrDto {
  @IsString()
  @IsNotEmpty()
  qrPayload!: string;
}
