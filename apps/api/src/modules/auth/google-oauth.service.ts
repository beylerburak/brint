import { randomUUID } from 'crypto';
import type { User, Session } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';
import { sessionService } from '../../core/auth/session.service.js';
import { logger } from '../../lib/logger.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleLoginContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface GoogleLoginResult {
  user: User;
  session: Session;
  accessToken: string;
  refreshToken: string;
}

export async function loginOrRegisterWithGoogle(
  profile: GoogleProfile,
  ctx: GoogleLoginContext,
): Promise<GoogleLoginResult> {
  const { email, sub, email_verified, name, picture } = profile;

  if (!email) {
    // defensive, ama decode aşamasında filtrelemiş olacağız
    throw new Error('GOOGLE_OAUTH_NO_EMAIL');
  }

  // 1) User'ı bul
  let user = await prisma.user.findUnique({
    where: { email },
  });

  // 2) Yoksa oluştur
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        avatarUrl: picture ?? null,
        emailVerified: email_verified ? new Date() : null,
        googleId: sub,
      },
    });
  } else {
    // Varsa ve googleId yoksa ekle
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: sub },
      });
    } else if (user.googleId !== sub) {
      // Şüpheli durum: aynı email, farklı Google account
      logger.warn(
        {
          userId: user.id,
          email,
          oldGoogleId: user.googleId,
          newGoogleId: sub,
        },
        'Google OAuth: email already linked to another googleId',
      );
      // Şimdilik sadece log, davranışı değiştirmiyoruz
    }
  }

  // 3) Session oluştur
  const tid = randomUUID();
  const session = await sessionService.createSession({
    userId: user.id,
    tid,
    userAgent: ctx.userAgent ?? null,
    ipAddress: ctx.ipAddress ?? null,
  });

  // 4) Fetch all workspace memberships for JWT payload
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    select: {
      workspaceId: true,
      role: true,
    },
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspaceId,
    role: m.role,
  }));

  // 5) Token'ları üret
  const accessToken = tokenService.signAccessToken({
    sub: user.id,
    email: user.email,
    workspaces,
    hasCompletedOnboarding: !!user.onboardingCompletedAt,
  });

  const refreshToken = tokenService.signRefreshToken({
    sub: user.id,
    tid: session.id,
  });

  return {
    user,
    session,
    accessToken,
    refreshToken,
  };
}

