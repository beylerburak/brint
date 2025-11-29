import { env } from './env.js';

/**
 * Application configuration
 * Centralized config for CORS, error handling, and environment flags
 */
export const appConfig = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  isProd: env.NODE_ENV === 'production',

  exposeStackTraces: env.NODE_ENV === 'development',

  appUrl: env.APP_URL,
  frontendUrl: env.FRONTEND_URL,
  additionalAllowedOrigins: env.ADDITIONAL_ALLOWED_ORIGINS,
} as const;

