import type { FastifyReply } from 'fastify';
import { authConfig } from '../../config/index.js';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

const isProduction = process.env.NODE_ENV === 'production';

export function setAuthCookies(reply: FastifyReply, tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const accessMaxAgeSeconds = authConfig.accessToken.expiresInMinutes * 60;
  const refreshMaxAgeSeconds = authConfig.refreshToken.expiresInDays * 24 * 60 * 60;

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
  };

  reply
    .setCookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
      ...cookieOptions,
      maxAge: accessMaxAgeSeconds,
    })
    .setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: refreshMaxAgeSeconds,
    });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply
    .clearCookie(ACCESS_COOKIE_NAME, { path: '/' })
    .clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
}

