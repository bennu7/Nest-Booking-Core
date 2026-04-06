import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleUserStatusDto {
  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
