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
  facebook: {
    appId: env.FACEBOOK_APP_ID ?? '',
    appSecret: env.FACEBOOK_APP_SECRET ?? '',
    authBaseUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v24.0/oauth/access_token',
    graphApiUrl: 'https://graph.facebook.com/v24.0',
    // Facebook Pages & Instagram Business account scopes
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'business_management',
    ] as const,
    enabled: !!env.FACEBOOK_APP_ID && !!env.FACEBOOK_APP_SECRET,
  },
  tiktok: {
    clientKey: env.TIKTOK_CLIENT_KEY ?? '',
    clientSecret: env.TIKTOK_CLIENT_SECRET ?? '',
    redirectUri: env.TIKTOK_REDIRECT_URI ?? '',
    authBaseUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/',
    // TikTok scopes - start minimal, add more after app review
    scopes: [
      'user.info.basic',
    ] as const,
    enabled: !!env.TIKTOK_CLIENT_KEY && !!env.TIKTOK_CLIENT_SECRET && !!env.TIKTOK_REDIRECT_URI,
  },
  linkedin: {
    clientId: env.LINKEDIN_CLIENT_ID ?? '',
    clientSecret: env.LINKEDIN_CLIENT_SECRET ?? '',
    redirectUri: env.LINKEDIN_REDIRECT_URI ?? '',
    authBaseUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    organizationsUrl: 'https://api.linkedin.com/v2/organizationAcls',
    organizationDetailsUrl: 'https://api.linkedin.com/v2/organizations',
    // LinkedIn scopes for pages (personal and organization)
    // r_organization_admin or rw_organization_admin is required for organizationAcls endpoint
    scopes: [
      'openid',
      'profile',
      'email',
      'w_member_social',
      'w_organization_social',
      'r_organization_admin', // Required to access organizationAcls endpoint
    ] as const,
    enabled: !!env.LINKEDIN_CLIENT_ID && !!env.LINKEDIN_CLIENT_SECRET && !!env.LINKEDIN_REDIRECT_URI,
  },
  x: {
    clientId: env.X_CLIENT_ID ?? '',
    clientSecret: env.X_CLIENT_SECRET ?? '',
    redirectUri: env.X_REDIRECT_URI ?? '',
    authBaseUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    // X OAuth 2.0 scopes
    scopes: [
      'tweet.read',
      'users.read',
      'offline.access',
    ] as const,
    enabled: !!env.X_CLIENT_ID && !!env.X_CLIENT_SECRET && !!env.X_REDIRECT_URI,
  },
  pinterest: {
    appId: env.PINTEREST_APP_ID ?? '',
    appSecret: env.PINTEREST_APP_SECRET ?? '',
    redirectUri: env.PINTEREST_REDIRECT_URI ?? '',
    authBaseUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    userInfoUrl: 'https://api.pinterest.com/v5/user_account',
    // Pinterest OAuth scopes
    scopes: [
      'user_accounts:read',
      'pins:read',
      'boards:read',
    ] as const,
    enabled: !!env.PINTEREST_APP_ID && !!env.PINTEREST_APP_SECRET && !!env.PINTEREST_REDIRECT_URI,
  },
  youtube: {
    clientId: env.YOUTUBE_CLIENT_ID ?? '',
    clientSecret: env.YOUTUBE_CLIENT_SECRET ?? '',
    redirectUri: env.YOUTUBE_REDIRECT_URI ?? '',
    authBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    channelsUrl: 'https://www.googleapis.com/youtube/v3/channels',
    // YouTube Data API v3 scopes
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.channel-memberships.creator',
    ] as const,
    enabled: !!env.YOUTUBE_CLIENT_ID && !!env.YOUTUBE_CLIENT_SECRET && !!env.YOUTUBE_REDIRECT_URI,
  },
} as const;

/**
 * Application URL configuration
 * Used for generating absolute URLs (e.g., magic link URLs)
 */
export const appUrlConfig = {
  baseUrl: env.APP_URL ?? `http://localhost:${appConfig.port}`,
  frontendUrl: env.FRONTEND_URL ?? `http://localhost:3000`,
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
