import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  bufferMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}
