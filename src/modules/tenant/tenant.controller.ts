import { Body, Controller, Get, HttpStatus, Param, Post } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ApiResponse } from 'src/common/dto/api-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@generated/enums';

@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  async create(@Body() dto: CreateTenantDto) {
    const result = await this.tenantService.create(dto);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Tenant created successfully',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.tenantService.findOne(id);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const result = await this.tenantService.findBySlug(slug);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }
}
