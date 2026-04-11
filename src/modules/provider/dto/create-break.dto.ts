import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBreakDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  dayOfWeek?: number;

  @IsOptional()
  @IsDateString()
  breakStart?: string;

  @IsOptional()
  @IsDateString()
  breakEnd?: string;

  @IsOptional()
  @IsDateString()
  dateStart?: string;

  @IsOptional()
  @IsDateString()
  dateEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
