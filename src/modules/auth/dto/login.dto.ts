import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  tenantId?: string | null; // users must know which tenant they want to log in to, if null is super admin

  @IsEmail({}, { message: 'Format email salah' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;
}
