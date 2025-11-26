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
  APP_URL: z.string().url().optional(),
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
} as const;

export type Env = typeof env;

