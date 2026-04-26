import type { PrismaClient, RefreshToken } from '@prisma/client';

export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  rotate(input: { oldId: string; newTokenHash: string; expiresAt: Date; userId: string }): Promise<RefreshToken>;
  revokeChain(userId: string, startTokenId: string): Promise<void>;
  revokeById(id: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data: input });
  }

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async rotate(input: {
    oldId: string;
    newTokenHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.newTokenHash,
          expiresAt: input.expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: input.oldId },
        data: { revokedAt: new Date(), replacedBy: created.id },
      });
      return created;
    });
  }

  async revokeChain(userId: string, _startTokenId: string): Promise<void> {
    // Token-theft response: revoke ALL active refresh tokens for the user.
    // The follow-the-chain approach is also valid; user-wide revocation is simpler and safer.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
