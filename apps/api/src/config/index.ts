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
 * Will be populated in future TS steps
 */
export const dbConfig = {
  databaseUrl: null as string | null,
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

