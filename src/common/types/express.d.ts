import { CurrentUserPayload } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUserPayload;
      /** Set by TenantContextInterceptor from JWT user (nullable for platform users). */
      tenantId?: string | null;
    }
  }
}

export {};
