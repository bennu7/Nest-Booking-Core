import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
