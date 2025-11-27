import { randomUUID } from 'crypto';
import type { User, Workspace } from '@prisma/client';
import { redis } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';
import { workspaceRepository } from '../workspace/workspace.repository.js';
import { logger } from '../../lib/logger.js';

export interface CreateMagicLinkInput {
  email: string;
  redirectTo?: string | null;
}

export interface CreateMagicLinkResult {
  token: string;
  payload: {
    email: string;
    redirectTo?: string | null;
  };
}

export interface ConsumeMagicLinkResult {
  user: User;
  workspace: Workspace | null; // null for new users (they go to onboarding) - kept for backward compatibility
  ownerWorkspaces: Workspace[]; // Workspaces where user is owner
  memberWorkspaces: Workspace[]; // Workspaces where user is member (not owner)
  accessToken: string;
  refreshToken: string;
  redirectTo?: string | null;
}

interface MagicLinkPayload {
  email: string;
  createdAt: string;
  redirectTo?: string | null;
}

class MagicLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MagicLinkError';
  }
}

export const magicLinkService = {
  async createMagicLink(input: CreateMagicLinkInput): Promise<CreateMagicLinkResult> {
    // Normalize email
    const email = input.email.trim().toLowerCase();

    if (!email) {
      throw new MagicLinkError('Email is required');
    }

    // Generate token
    const token = randomUUID();

    // Create payload
    const payload: MagicLinkPayload = {
      email,
      createdAt: new Date().toISOString(),
      redirectTo: input.redirectTo ?? null,
    };

    // Store in Redis with TTL (900 seconds = 15 minutes)
    const redisKey = `magic_link:${token}`;
    await redis.setex(redisKey, 900, JSON.stringify(payload));

    logger.debug(
      {
        email,
        token: token.substring(0, 8) + '...',
      },
      'Magic link created'
    );

    return {
      token,
      payload: {
        email,
        redirectTo: input.redirectTo ?? null,
      },
    };
  },

  async consumeMagicLink(
    token: string,
    context?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<ConsumeMagicLinkResult> {
    // Read from Redis
    const redisKey = `magic_link:${token}`;
    const rawPayload = await redis.get(redisKey);

    if (!rawPayload) {
      throw new MagicLinkError('Magic link invalid or expired');
    }

    // Parse payload
    let payload: MagicLinkPayload;
    try {
      payload = JSON.parse(rawPayload) as MagicLinkPayload;
    } catch (error) {
      logger.error({ error, token: token.substring(0, 8) + '...' }, 'Failed to parse magic link payload');
      throw new MagicLinkError('Magic link invalid or expired');
    }

    // Delete immediately (one-time use)
    await redis.del(redisKey);

    const { email } = payload;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: null,
          emailVerified: new Date(),
        },
      });
    } else if (!user.emailVerified) {
      // Update emailVerified if not set
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    // Get all workspace memberships (owner and member)
    const allMemberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });

    // Sort by workspace updatedAt (most recently updated first)
    allMemberships.sort((a, b) => 
      b.workspace.updatedAt.getTime() - a.workspace.updatedAt.getTime()
    );

    // Separate owner and member workspaces
    const ownerWorkspaces = allMemberships
      .filter((m) => m.role === 'owner')
      .map((m) => m.workspace);
    const memberWorkspaces = allMemberships
      .filter((m) => m.role !== 'owner')
      .map((m) => m.workspace);

    // For backward compatibility, keep the first workspace (most recently updated)
    const workspace = allMemberships.length > 0 ? allMemberships[0].workspace : null;

    // Create session
    const tid = randomUUID();
    await sessionService.createSession({
      userId: user.id,
      tid,
      userAgent: context?.userAgent ?? null,
      ipAddress: context?.ipAddress ?? null,
    });

    // Generate tokens
    // If workspace exists, include wid in access token, otherwise omit it
    const accessTokenPayload: { sub: string; wid?: string } = {
      sub: user.id,
    };
    if (workspace) {
      accessTokenPayload.wid = workspace.id;
    }

    const accessToken = tokenService.signAccessToken(accessTokenPayload);

    const refreshToken = tokenService.signRefreshToken({
      sub: user.id,
      tid,
    });

    logger.info(
      {
        userId: user.id,
        workspaceId: workspace?.id ?? null,
        email,
        isNewUser: !workspace,
      },
      'Magic link consumed successfully'
    );

    return {
      user,
      workspace, // Can be null for new users - kept for backward compatibility
      ownerWorkspaces,
      memberWorkspaces,
      accessToken,
      refreshToken,
      redirectTo: payload.redirectTo,
    };
  },
};

