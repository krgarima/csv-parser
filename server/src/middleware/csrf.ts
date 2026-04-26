import type { RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { ForbiddenError } from '@lib/errors';
import { CSRF_COOKIE } from './requireAuth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie CSRF protection.
 * - On every request, ensure a `csv_csrf` cookie exists (issue if missing).
 * - On mutating requests, require the `X-CSRF-Token` header to equal the cookie value.
 * The cookie is intentionally NOT httpOnly — JS reads it to attach the header.
 */
export function csrfMiddleware(input: { cookieDomain: string; secure: boolean }): RequestHandler {
  return (req, res, next) => {
    let token = req.cookies?.[CSRF_COOKIE] as string | undefined;
    if (!token) {
      token = randomBytes(24).toString('base64url');
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: input.secure,
        sameSite: 'lax',
        domain: input.cookieDomain || undefined,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    if (SAFE_METHODS.has(req.method)) return next();

    const header = req.get('x-csrf-token');
    if (!header || header !== token) {
      return next(new ForbiddenError('Invalid CSRF token'));
    }
    next();
  };
}
