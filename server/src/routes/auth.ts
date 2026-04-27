import { Router } from 'express';
import type { RequestHandler, Response } from 'express';
import type { Config } from '@config/env';
import type { AuthService, AuthTokens } from '@services/authService';
import type { UserRepository } from '@db/repositories/userRepo';
import { LoginSchema, SignupSchema } from '@schemas/auth';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@middleware/requireAuth';
import { loginLimiter } from '@middleware/rateLimit';
import { UnauthorizedError } from '@lib/errors';

function setAuthCookies(res: Response, tokens: AuthTokens, config: Config): void {
  const secure = config.NODE_ENV === 'production';
  const domain = config.COOKIE_DOMAIN || undefined;

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    domain,
    path: '/',
    // Access cookie expires when the JWT does — but we leave maxAge unset so
    // the cookie itself sticks around; the JWT exp is the real authority.
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    domain,
    path: '/api/auth',
    expires: tokens.refreshExpiresAt,
  });
}

function clearAuthCookies(res: Response, config: Config): void {
  const domain = config.COOKIE_DOMAIN || undefined;
  res.clearCookie(ACCESS_COOKIE, { path: '/', domain });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth', domain });
}

export function createAuthRouter(input: {
  config: Config;
  authService: AuthService;
  userRepo: UserRepository;
  requireAuth: RequestHandler;
}): Router {
  const { config, authService, userRepo, requireAuth } = input;
  const router = Router();

  router.post('/signup', async (req, res, next) => {
    try {
      const body = SignupSchema.parse(req.body);
      const { userId, tokens } = await authService.signup(body);
      setAuthCookies(res, tokens, config);
      const user = await userRepo.findById(userId);
      res.status(201).json({
        user: {
          id: userId,
          email: body.email.toLowerCase().trim(),
          name: user?.name ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const body = LoginSchema.parse(req.body);
      const { userId, tokens } = await authService.login(body);
      setAuthCookies(res, tokens, config);
      const user = await userRepo.findById(userId);
      res.json({
        user: {
          id: userId,
          email: body.email.toLowerCase().trim(),
          name: user?.name ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const refresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (!refresh) throw new UnauthorizedError('No refresh token');
      const tokens = await authService.refresh(refresh);
      setAuthCookies(res, tokens, config);
      res.json({ ok: true });
    } catch (err) {
      // On any refresh failure, clear cookies so the client can recover cleanly.
      clearAuthCookies(res, config);
      next(err);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const refresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (refresh) await authService.logout(refresh);
      clearAuthCookies(res, config);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const user = await userRepo.findById(req.userId!);
      if (!user) throw new UnauthorizedError('User not found');
      res.json({
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
