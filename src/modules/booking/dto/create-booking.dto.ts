import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  slotHoldId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
