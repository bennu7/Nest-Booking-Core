import type { CurrentUserPayload } from '../decorators/current-user.decorator';

export interface TenantContext {
  tenantId: string;
  currentUser: CurrentUserPayload;
}
