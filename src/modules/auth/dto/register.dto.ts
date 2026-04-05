import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '@generated/enums';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email salah' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.CUSTOMER;
}
