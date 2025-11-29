import { config } from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Go up from apps/api/src/config to project root
const rootDir = join(__dirname, '../../../../');
config({ path: join(rootDir, '.env') });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.string().min(1, 'API_PORT is required'),
  API_HOST: z.string().default('0.0.0.0'),
  API_LOG_LEVEL: z.string().default('info'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  ADDITIONAL_ALLOWED_ORIGINS: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  CORS_ALLOW_CREDENTIALS: z.string().optional().default('true'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  S3_MEDIA_BUCKET: z.string().min(1, 'S3_MEDIA_BUCKET is required'),
  S3_PUBLIC_CDN_URL: z.preprocess((val) => val === '' ? undefined : val, z.string().url().optional()),
  STORAGE_UPLOAD_EXPIRE_SECONDS: z.coerce.number().int().positive().default(60),
  STORAGE_DOWNLOAD_EXPIRE_SECONDS: z.coerce.number().int().positive().default(120),
  STORAGE_AVATAR_MAX_MB: z.coerce.number().positive().default(5),
  STORAGE_AVATAR_EXTENSIONS: z.string().optional(),
  STORAGE_AVATAR_MIME_TYPES: z.string().optional(),
  STORAGE_CONTENT_IMAGE_MAX_MB: z.coerce.number().positive().default(50),
  STORAGE_CONTENT_IMAGE_EXTENSIONS: z.string().optional(),
  STORAGE_CONTENT_IMAGE_MIME_TYPES: z.string().optional(),
  STORAGE_CONTENT_VIDEO_MAX_MB: z.coerce.number().positive().default(200),
  STORAGE_CONTENT_VIDEO_EXTENSIONS: z.string().optional(),
  STORAGE_CONTENT_VIDEO_MIME_TYPES: z.string().optional(),
  STORAGE_VARIANT_THUMB_WIDTH: z.coerce.number().int().positive().default(240),
  STORAGE_VARIANT_THUMB_HEIGHT: z.coerce.number().int().positive().default(240),
  STORAGE_VARIANT_THUMB_QUALITY: z.coerce.number().int().positive().max(100).default(70),
  STORAGE_VARIANT_SM_WIDTH: z.coerce.number().int().positive().default(480),
  STORAGE_VARIANT_SM_QUALITY: z.coerce.number().int().positive().max(100).default(75),
  STORAGE_VARIANT_MD_WIDTH: z.coerce.number().int().positive().default(960),
  STORAGE_VARIANT_MD_QUALITY: z.coerce.number().int().positive().max(100).default(80),
  STORAGE_VARIANT_LG_WIDTH: z.coerce.number().int().positive().default(1600),
  STORAGE_VARIANT_LG_QUALITY: z.coerce.number().int().positive().max(100).default(80),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SENTRY_DSN_API: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
});

type EnvSchema = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment validation failed:');
  parseResult.error.errors.forEach((error) => {
    console.error(`  - ${error.path.join('.')}: ${error.message}`);
  });
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  process.exit(1);
}

const rawEnv = parseResult.data;

export const env = {
  NODE_ENV: rawEnv.NODE_ENV,
  API_PORT: parseInt(rawEnv.API_PORT, 10),
  API_HOST: rawEnv.API_HOST,
  API_LOG_LEVEL: rawEnv.API_LOG_LEVEL,
  REDIS_URL: rawEnv.REDIS_URL,
  DATABASE_URL: rawEnv.DATABASE_URL,
  ACCESS_TOKEN_SECRET: rawEnv.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: rawEnv.REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN_MINUTES: rawEnv.ACCESS_TOKEN_EXPIRES_IN_MINUTES,
  REFRESH_TOKEN_EXPIRES_IN_DAYS: rawEnv.REFRESH_TOKEN_EXPIRES_IN_DAYS,
  GOOGLE_OAUTH_CLIENT_ID: rawEnv.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: rawEnv.GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI: rawEnv.GOOGLE_OAUTH_REDIRECT_URI,
  APP_URL: rawEnv.APP_URL,
  FRONTEND_URL: rawEnv.FRONTEND_URL,
  ADDITIONAL_ALLOWED_ORIGINS: rawEnv.ADDITIONAL_ALLOWED_ORIGINS,
  CORS_ALLOWED_ORIGINS: rawEnv.CORS_ALLOWED_ORIGINS,
  CORS_ALLOW_CREDENTIALS: rawEnv.CORS_ALLOW_CREDENTIALS,
  AWS_REGION: rawEnv.AWS_REGION,
  S3_MEDIA_BUCKET: rawEnv.S3_MEDIA_BUCKET,
  S3_PUBLIC_CDN_URL: rawEnv.S3_PUBLIC_CDN_URL,
  STORAGE_UPLOAD_EXPIRE_SECONDS: rawEnv.STORAGE_UPLOAD_EXPIRE_SECONDS,
  STORAGE_DOWNLOAD_EXPIRE_SECONDS: rawEnv.STORAGE_DOWNLOAD_EXPIRE_SECONDS,
  STORAGE_AVATAR_MAX_MB: rawEnv.STORAGE_AVATAR_MAX_MB,
  STORAGE_AVATAR_EXTENSIONS: rawEnv.STORAGE_AVATAR_EXTENSIONS,
  STORAGE_AVATAR_MIME_TYPES: rawEnv.STORAGE_AVATAR_MIME_TYPES,
  STORAGE_CONTENT_IMAGE_MAX_MB: rawEnv.STORAGE_CONTENT_IMAGE_MAX_MB,
  STORAGE_CONTENT_IMAGE_EXTENSIONS: rawEnv.STORAGE_CONTENT_IMAGE_EXTENSIONS,
  STORAGE_CONTENT_IMAGE_MIME_TYPES: rawEnv.STORAGE_CONTENT_IMAGE_MIME_TYPES,
  STORAGE_CONTENT_VIDEO_MAX_MB: rawEnv.STORAGE_CONTENT_VIDEO_MAX_MB,
  STORAGE_CONTENT_VIDEO_EXTENSIONS: rawEnv.STORAGE_CONTENT_VIDEO_EXTENSIONS,
  STORAGE_CONTENT_VIDEO_MIME_TYPES: rawEnv.STORAGE_CONTENT_VIDEO_MIME_TYPES,
  STORAGE_VARIANT_THUMB_WIDTH: rawEnv.STORAGE_VARIANT_THUMB_WIDTH,
  STORAGE_VARIANT_THUMB_HEIGHT: rawEnv.STORAGE_VARIANT_THUMB_HEIGHT,
  STORAGE_VARIANT_THUMB_QUALITY: rawEnv.STORAGE_VARIANT_THUMB_QUALITY,
  STORAGE_VARIANT_SM_WIDTH: rawEnv.STORAGE_VARIANT_SM_WIDTH,
  STORAGE_VARIANT_SM_QUALITY: rawEnv.STORAGE_VARIANT_SM_QUALITY,
  STORAGE_VARIANT_MD_WIDTH: rawEnv.STORAGE_VARIANT_MD_WIDTH,
  STORAGE_VARIANT_MD_QUALITY: rawEnv.STORAGE_VARIANT_MD_QUALITY,
  STORAGE_VARIANT_LG_WIDTH: rawEnv.STORAGE_VARIANT_LG_WIDTH,
  STORAGE_VARIANT_LG_QUALITY: rawEnv.STORAGE_VARIANT_LG_QUALITY,
  SMTP_HOST: rawEnv.SMTP_HOST,
  SMTP_PORT: rawEnv.SMTP_PORT,
  SMTP_SECURE: rawEnv.SMTP_SECURE,
  SMTP_USER: rawEnv.SMTP_USER,
  SMTP_PASS: rawEnv.SMTP_PASS,
  SMTP_FROM: rawEnv.SMTP_FROM,
  SENTRY_DSN_API: rawEnv.SENTRY_DSN_API,
  SENTRY_ENVIRONMENT: rawEnv.SENTRY_ENVIRONMENT,
  SENTRY_TRACES_SAMPLE_RATE: rawEnv.SENTRY_TRACES_SAMPLE_RATE,
} as const;

export type Env = typeof env;
