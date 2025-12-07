/**
 * Worker Process Entry Point
 * 
 * Starts the media processing worker.
 * Run this separately from the main API server:
 * 
 * pnpm run worker
 * or
 * node dist/worker.js
 */

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiDir = join(__dirname, '../');
const rootDir = join(__dirname, '../../../');

// Load apps/api/.env first (priority), then root .env
config({ path: join(apiDir, '.env'), override: true });
config({ path: join(rootDir, '.env') });

import { createMediaWorker } from './core/queue/media-worker.js';
import { logger } from './lib/logger.js';

logger.info('Starting media processing worker...');

const worker = createMediaWorker();

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down worker...');
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info('Media processing worker is running');

