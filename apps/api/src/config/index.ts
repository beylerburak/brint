import { env } from './env.js';
import { storageConfig } from './storage.config.js';

/**
 * Application-level configuration
 * Maps environment variables to application settings
 */
export const appConfig = {
  env: env.NODE_ENV,
  port: env.API_PORT,
  host: env.API_HOST,
  logLevel: env.API_LOG_LEVEL,
} as const;

/**
 * Database configuration
 */
export const dbConfig = {
  databaseUrl: env.DATABASE_URL,
};

/**
 * Cache configuration (Redis)
 */
export const cacheConfig = {
  redisUrl: env.REDIS_URL,
};

/**
 * Upload configuration
 * Will be populated in future TS steps
 */
export const uploadConfig = {
  maxUploadSizeMb: 10,
};

/**
 * Authentication configuration
 */
export const authConfig = {
  issuer: 'brint-api',
  accessToken: {
    secret: env.ACCESS_TOKEN_SECRET,
    expiresInMinutes: env.ACCESS_TOKEN_EXPIRES_IN_MINUTES,
  },
  refreshToken: {
    secret: env.REFRESH_TOKEN_SECRET,
    expiresInDays: env.REFRESH_TOKEN_EXPIRES_IN_DAYS,
  },
} as const;

/**
 * OAuth configuration
 */
export const oauthConfig = {
  google: {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    authBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // 'phone' eklenerek phone_number claim'i alınır; userinfo ile de telefon çekilir
    scopes: ['openid', 'email', 'profile', 'phone'] as const,
  },
} as const;

/**
 * Application URL configuration
 * Used for generating absolute URLs (e.g., magic link URLs)
 */
export const appUrlConfig = {
  baseUrl: env.APP_URL ?? `http://localhost:${appConfig.port}`,
} as const;

/**
 * Storage configuration (S3 + variants)
 */
export { storageConfig };

/**
 * Email configuration (SMTP)
 */
export const emailConfig = {
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true' || env.SMTP_SECURE === '1',
    auth: env.SMTP_USER && env.SMTP_PASS
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  },
  from: env.SMTP_FROM ?? 'EPRU <no-reply@epru.app>',
  enabled: !!env.SMTP_HOST,
} as const;
