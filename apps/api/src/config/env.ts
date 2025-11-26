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
} as const;

export type Env = typeof env;

