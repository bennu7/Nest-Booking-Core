import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  dayOfWeek: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateScheduleDto {
  days: ScheduleDayDto[];
}
