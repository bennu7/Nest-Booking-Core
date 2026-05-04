import { IsDateString, IsUUID } from 'class-validator';

export class CreateSlotHoldDto {
  @IsUUID()
  providerId!: string;

  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;
}
