import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GetAvailabilityDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
