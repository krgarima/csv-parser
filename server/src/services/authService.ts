import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { Config } from '@config/env';
import type { UserRepository } from '@db/repositories/userRepo';
import type { SessionRepository } from '@db/repositories/sessionRepo';
import { ConflictError, UnauthorizedError } from '@lib/errors';
import { sha256 } from '@lib/hash';
import { logger } from '@lib/logger';

const BCRYPT_COST = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthService {
  signup(input: { email: string; password: string }): Promise<{ userId: string; tokens: AuthTokens }>;
  login(input: { email: string; password: string }): Promise<{ userId: string; tokens: AuthTokens }>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  logout(refreshToken: string): Promise<void>;
  verifyAccessToken(token: string): { userId: string };
}

interface AccessTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

function parseTtlToSeconds(ttl: string): number {
  // Accepts "15m", "7d", "3600", "2h"
  const match = ttl.match(/^(\d+)([smhd])?$/);
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(match[1]);
  const unit = match[2] ?? 's';
  switch (unit) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86_400;
    default:
      throw new Error(`Invalid TTL unit: ${unit}`);
  }
}

export function createAuthService(input: {
  config: Config;
  userRepo: UserRepository;
  sessionRepo: SessionRepository;
}): AuthService {
  const { config, userRepo, sessionRepo } = input;
  const accessTtlSec = parseTtlToSeconds(config.ACCESS_TOKEN_TTL);
  const refreshTtlSec = parseTtlToSeconds(config.REFRESH_TOKEN_TTL);

  function signAccessToken(userId: string): string {
    return jwt.sign({}, config.ACCESS_TOKEN_SECRET, {
      subject: userId,
      expiresIn: accessTtlSec,
      algorithm: 'HS256',
    });
  }

  function generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = randomBytes(48).toString('base64url');
    return {
      raw,
      hash: sha256(raw),
      expiresAt: new Date(Date.now() + refreshTtlSec * 1000),
    };
  }

  async function issueTokens(userId: string): Promise<AuthTokens> {
    const refresh = generateRefreshToken();
    await sessionRepo.create({
      userId,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
    });
    return {
      accessToken: signAccessToken(userId),
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  return {
    async signup(input) {
      const normalized = input.email.toLowerCase().trim();
      const existing = await userRepo.findByEmail(normalized);
      if (existing) {
        throw new ConflictError('An account with that email already exists');
      }
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
      const user = await userRepo.create({ email: normalized, passwordHash });
      const tokens = await issueTokens(user.id);
      return { userId: user.id, tokens };
    },

    async login(input) {
      const normalized = input.email.toLowerCase().trim();
      const user = await userRepo.findByEmail(normalized);
      if (!user) {
        // Constant-time comparison: still hash to avoid user-enumeration timing.
        await bcrypt.compare(input.password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalid12345678');
        throw new UnauthorizedError('Invalid credentials');
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedError('Invalid credentials');
      }
      const tokens = await issueTokens(user.id);
      return { userId: user.id, tokens };
    },

    async refresh(refreshToken) {
      const tokenHash = sha256(refreshToken);
      const stored = await sessionRepo.findByTokenHash(tokenHash);
      if (!stored) throw new UnauthorizedError('Invalid refresh token');

      // Theft detection: a previously-revoked token being presented again means
      // somebody is replaying. Revoke the entire user's active token chain.
      if (stored.revokedAt !== null) {
        logger.warn(
          { userId: stored.userId, tokenId: stored.id },
          'Refresh token reuse detected — revoking all active tokens for user',
        );
        await sessionRepo.revokeChain(stored.userId, stored.id);
        throw new UnauthorizedError('Token reuse detected');
      }

      if (stored.expiresAt < new Date()) {
        throw new UnauthorizedError('Refresh token expired');
      }

      // Rotate
      const next = generateRefreshToken();
      await sessionRepo.rotate({
        oldId: stored.id,
        newTokenHash: next.hash,
        expiresAt: next.expiresAt,
        userId: stored.userId,
      });

      return {
        accessToken: signAccessToken(stored.userId),
        refreshToken: next.raw,
        refreshExpiresAt: next.expiresAt,
      };
    },

    async logout(refreshToken) {
      const tokenHash = sha256(refreshToken);
      const stored = await sessionRepo.findByTokenHash(tokenHash);
      if (stored && stored.revokedAt === null) {
        await sessionRepo.revokeById(stored.id);
      }
    },

    verifyAccessToken(token) {
      try {
        const payload = jwt.verify(token, config.ACCESS_TOKEN_SECRET, {
          algorithms: ['HS256'],
        }) as AccessTokenPayload;
        if (!payload.sub) throw new UnauthorizedError('Invalid token');
        return { userId: payload.sub };
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        throw new UnauthorizedError('Invalid or expired access token');
      }
    },
  };
}
