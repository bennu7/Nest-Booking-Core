import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startAt = Date.now();
    const logger = this.logger;

    res.on('finish', () => {
      const responseTime = Date.now() - startAt;
      const statusCode = res.statusCode;
      const method = req.method;
      const url = req.originalUrl;
      const userAgent = req.headers['user-agent'] || '';

      const statusColor =
        statusCode >= 500
          ? '\x1b[31m'
          : statusCode >= 400
            ? '\x1b[33m'
            : statusCode >= 300
              ? '\x1b[36m'
              : '\x1b[32m';

      const reset = '\x1b[0m';

      logger.log(
        `${method} ${url} ${statusColor}${statusCode}${reset} ${responseTime}ms - ${userAgent}`,
      );
    });

    next();
  }
}
