import { env } from './env.js';

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
 * Security configuration
 * Will be populated in future TS steps
 */
export const securityConfig = {
  accessTokenSecret: null as string | null,
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

