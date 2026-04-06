import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleStatusDto {
  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
