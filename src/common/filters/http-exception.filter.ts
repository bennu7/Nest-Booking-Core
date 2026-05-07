import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorResponse } from '../dto/api-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      code = exception.getStatus();
      const res = exception.getResponse() as any;
      message =
        typeof res === 'object' ? res.message || exception.message : res;
      error = exception.name;
    }

    const errorResponse = new ErrorResponse({
      code,
      message,
      error,
    });

    response.status(code).json(errorResponse);
  }
}
