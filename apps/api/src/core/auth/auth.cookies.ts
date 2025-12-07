import type { FastifyReply } from 'fastify';
import { authConfig, appConfig } from '../../config/index.js';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

export function setAuthCookies(reply: FastifyReply, tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const accessMaxAgeSeconds = authConfig.accessToken.expiresInMinutes * 60;
  const refreshMaxAgeSeconds = authConfig.refreshToken.expiresInDays * 24 * 60 * 60;

  const cookieOptions = {
    httpOnly: true,
    secure: appConfig.env === 'production',
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
  const cookieOptions = {
    httpOnly: true,
    secure: appConfig.env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  reply
    .clearCookie(ACCESS_COOKIE_NAME, cookieOptions)
    .clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
}

