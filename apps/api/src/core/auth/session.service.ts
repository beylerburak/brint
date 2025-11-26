import type { Session } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

export interface CreateSessionInput {
  userId: string;
  tid: string; // refresh token payload'daki `tid`
  userAgent?: string | null;
  ipAddress?: string | null;
}

export const sessionService = {
  async createSession(input: CreateSessionInput): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + authConfig.refreshToken.expiresInDays * 24 * 60 * 60 * 1000
    );

    try {
      // Try to create the session
      const session = await prisma.session.create({
        data: {
          id: input.tid,
          userId: input.userId,
          expiresAt,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          lastActiveAt: now,
        },
      });

      logger.debug(
        {
          tid: input.tid,
          userId: input.userId,
          expiresAt: expiresAt.toISOString(),
        },
        'Session created'
      );

      return session;
    } catch (error: any) {
      // If session already exists (duplicate tid), update it
      if (error?.code === 'P2002' || error?.message?.includes('Unique constraint')) {
        logger.warn(
          {
            tid: input.tid,
            userId: input.userId,
          },
          'Session with tid already exists, updating existing session'
        );

        // Update existing session
        const updatedSession = await prisma.session.update({
          where: { id: input.tid },
          data: {
            userId: input.userId,
            expiresAt,
            userAgent: input.userAgent ?? null,
            ipAddress: input.ipAddress ?? null,
            lastActiveAt: now,
          },
        });

        return updatedSession;
      }

      // Re-throw other errors
      logger.error(
        {
          error,
          tid: input.tid,
          userId: input.userId,
        },
        'Failed to create session'
      );
      throw error;
    }
  },

  async revokeSession(tid: string): Promise<void> {
    try {
      const deleted = await prisma.session.delete({
        where: { id: tid },
      });

      logger.debug(
        {
          tid,
          userId: deleted.userId,
        },
        'Session revoked'
      );
    } catch (error: any) {
      // If session doesn't exist, just log and continue (idempotent)
      if (error?.code === 'P2025' || error?.message?.includes('Record to delete does not exist')) {
        logger.warn(
          {
            tid,
          },
          'Attempted to revoke non-existent session'
        );
        return;
      }

      logger.error(
        {
          error,
          tid,
        },
        'Failed to revoke session'
      );
      throw error;
    }
  },

  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const result = await prisma.session.deleteMany({
        where: { userId },
      });

      logger.info(
        {
          userId,
          deletedCount: result.count,
        },
        'All user sessions revoked'
      );
    } catch (error) {
      logger.error(
        {
          error,
          userId,
        },
        'Failed to revoke all user sessions'
      );
      throw error;
    }
  },

  async touchSession(tid: string): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: tid },
        data: {
          lastActiveAt: new Date(),
        },
      });

      logger.debug(
        {
          tid,
        },
        'Session touched'
      );
    } catch (error: any) {
      // If session doesn't exist, just log and continue (idempotent)
      if (error?.code === 'P2025' || error?.message?.includes('Record to update does not exist')) {
        logger.warn(
          {
            tid,
          },
          'Attempted to touch non-existent session'
        );
        return;
      }

      logger.error(
        {
          error,
          tid,
        },
        'Failed to touch session'
      );
      throw error;
    }
  },
};

