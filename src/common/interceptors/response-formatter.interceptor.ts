import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';
import type { Response } from 'express';

@Injectable()
export class ResponseFormatterInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse<Response>();

        if (data instanceof ApiResponse) {
          response.status(data.code);
          return data;
        }

        return new ApiResponse(data);
      }),
    );
  }
}
