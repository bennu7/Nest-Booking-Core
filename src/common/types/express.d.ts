import { CurrentUserPayload } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUserPayload;
    }
  }
}
