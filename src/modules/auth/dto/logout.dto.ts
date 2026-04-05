import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
