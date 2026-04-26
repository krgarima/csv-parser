import type { RequestHandler } from 'express';
import type { AuthService } from '@services/authService';
import { UnauthorizedError } from '@lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const ACCESS_COOKIE = 'csv_access';
export const REFRESH_COOKIE = 'csv_refresh';
export const CSRF_COOKIE = 'csv_csrf';

export function createRequireAuth(authService: AuthService): RequestHandler {
  return (req, _res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) return next(new UnauthorizedError('No access token'));
    try {
      const { userId } = authService.verifyAccessToken(token);
      req.userId = userId;
      next();
    } catch (err) {
      next(err);
    }
  };
}
