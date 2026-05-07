import { IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
