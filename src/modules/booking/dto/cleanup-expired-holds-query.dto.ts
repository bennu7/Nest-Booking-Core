import { IsOptional, IsUUID } from 'class-validator';

/** Untuk SUPER_ADMIN: wajib `tenantId` agar cleanup tidak lintas tenant tanpa sengaja. */
export class CleanupExpiredHoldsQueryDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
