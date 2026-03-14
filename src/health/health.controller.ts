import {
  Controller,
  Get,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiResponse } from 'src/common/dto/api-response.dto';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private healthSvc: HealthService) {}

  @Get()
  checkHealth() {
    return new ApiResponse({
      code: HttpStatus.OK,
      message: 'Success',
      data: null,
    });
  }

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
