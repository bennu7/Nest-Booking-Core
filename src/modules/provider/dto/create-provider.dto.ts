import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProviderDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;
}
