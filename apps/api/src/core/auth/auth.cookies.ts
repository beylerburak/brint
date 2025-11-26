import type { FastifyReply } from 'fastify';
import { authConfig } from '../../config/index.js';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

export function setAuthCookies(reply: FastifyReply, tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const accessMaxAgeSeconds = authConfig.accessToken.expiresInMinutes * 60;
  const refreshMaxAgeSeconds = authConfig.refreshToken.expiresInDays * 24 * 60 * 60;

  reply
    .setCookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
      // secure, httpOnly, sameSite vs. cookie plugin'de global olarak set
      maxAge: accessMaxAgeSeconds,
      path: '/',
    })
    .setCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      maxAge: refreshMaxAgeSeconds,
      path: '/',
    });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply
    .clearCookie(ACCESS_COOKIE_NAME, { path: '/' })
    .clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
}

