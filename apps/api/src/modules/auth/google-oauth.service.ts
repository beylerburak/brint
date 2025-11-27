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
  phone_number?: string;
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
  const { email, sub, email_verified, name, phone_number } = profile;

  if (!email || !sub) {
    // defensive, ama decode aşamasında filtrelemiş olacağız
    throw new Error('GOOGLE_OAUTH_NO_EMAIL');
  }

  // 1) User'ı bul (email öncelik, yoksa googleId)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { googleId: sub } });
  }

  // 2) Yoksa oluştur (unique conflict ihtimalini yakala)
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          email,
          name: name ?? null,
          phone: phone_number ?? null,
          emailVerified: email_verified ? new Date() : null,
          googleId: sub,
        },
      });
    } catch (error: any) {
      // Unique constraint ise mevcut user'ı çek ve güncelle
      if (error?.code === 'P2002') {
        logger.warn(
          { email, sub, target: error?.meta?.target },
          'Google OAuth create conflict, attempting to merge user'
        );
        user =
          (await prisma.user.findUnique({ where: { email } })) ??
          (await prisma.user.findUnique({ where: { googleId: sub } }));
      }
      if (!user) {
        throw error;
      }
    }
  }

  // 3) Güncelleme (Google verisi baskın)
  if (user) {
    const updates: Record<string, any> = {};

    if (!user.googleId) {
      updates.googleId = sub;
    } else if (user.googleId !== sub) {
      logger.warn(
        {
          userId: user.id,
          email,
          oldGoogleId: user.googleId,
          newGoogleId: sub,
        },
        'Google OAuth: email already linked to another googleId',
      );
    }

    if (name) updates.name = name;
    if (phone_number) updates.phone = phone_number;
    if (email_verified && !user.emailVerified) {
      updates.emailVerified = new Date();
    }

    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
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

  // 4) Token'ları üret
  const accessToken = tokenService.signAccessToken({
    sub: user.id,
    // workspaceId/brandId ileride workspace seçimi sonrası doldurulacak
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
