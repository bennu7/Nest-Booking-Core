import { IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

/** Untuk SUPER_ADMIN: wajib isi `tenantId` agar query tetap scoped per tenant. */
export class ListBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
