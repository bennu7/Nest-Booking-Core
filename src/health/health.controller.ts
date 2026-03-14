import {
  Controller,
  Get,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/api-response.dto';
import { HealthService } from './health.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private healthSvc: HealthService) {}

  @Public()
  @Get()
  checkHealth() {
    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: null,
    });
  }

  @Public()
  @Get('ready')
  async checkReady() {
    const isReady = await this.healthSvc.isDatabaseReady();

    if (!isReady)
      throw new ServiceUnavailableException('Database Not Connected');

    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Service is ready',
      data: {
        status: 'ready',
      },
    });
  }
}
