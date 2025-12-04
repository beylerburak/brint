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

