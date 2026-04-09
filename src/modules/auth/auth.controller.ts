import {
  Body,
  Controller,
  HttpStatus,
  Ip,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { RegisterDto } from './dto/register.dto';
import { ToggleUserStatusDto } from './dto/toggle-user-status.dto';
import { ApiResponse } from 'src/common/dto/api-response.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateTenantDto } from '../tenant/dto/create-tenant.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { CurrentUserPayload } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@generated/enums';

@Controller({ path: 'auth', version: '1' })
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Success',
      data: result,
    });
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: ip,
      userAgent,
    });

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Post('setup-tenant')
  async setupTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.authService.setupTenant(user.id, dto);

    return new ApiResponse({
      code: HttpStatus.CREATED,
      message: 'Tenant setup completed',
      data: result,
    });
  }

  @Public()
  @Post('refresh-token')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    const result = await this.authService.refreshToken(refreshToken);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    const result = await this.authService.logout(dto.refreshToken);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: result,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch('users/:id/status')
  async toggleUserStatus(
    @Param('id') userId: string,
    @Body() dto: ToggleUserStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.authService.toggleUserStatus(userId, dto, user);

    return new ApiResponse({
      code: HttpStatus.OK,
      message: dto.isActive
        ? 'User activated successfully'
        : 'User deactivated successfully',
      data: result,
    });
  }
}
