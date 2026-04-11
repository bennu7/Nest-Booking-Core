import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMinutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  bufferMinutes?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsString()
  @Min(1)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxCapacity?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
