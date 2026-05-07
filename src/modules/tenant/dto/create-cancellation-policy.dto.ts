import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateCancellationPolicyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  hoursBeforeFree?: number; // default 24

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  lateCancelCharge?: number; // default 50 (persentase)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  noShowCharge?: number; // default 100 (persentase)

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
