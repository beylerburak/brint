import { z } from 'zod';
import { logger } from '../utils/logger';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url('NEXT_PUBLIC_API_BASE_URL must be a valid URL'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

type EnvSchema = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parseResult.success) {
  logger.error('❌ Environment validation failed:');
  parseResult.error.errors.forEach((error) => {
    logger.error(`  - ${error.path.join('.')}: ${error.message}`);
  });
  logger.error('\nPlease check your .env file and ensure all required variables are set.');
  // In Next.js, we should throw an error to prevent the app from starting with invalid config
  throw new Error('Invalid environment configuration');
}

export const env = parseResult.data;

