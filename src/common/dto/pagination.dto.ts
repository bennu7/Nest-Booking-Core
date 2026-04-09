import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT;
}

export function getPaginationParams(dto: PaginationQueryDto): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = dto.page ?? DEFAULT_PAGE;
  const limit = dto.limit ?? DEFAULT_LIMIT;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}
