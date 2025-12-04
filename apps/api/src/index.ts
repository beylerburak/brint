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

import { FastifyInstance } from 'fastify';
import type { Worker } from 'bullmq';
import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { createServer } from './core/http/server.js';
import { createMediaWorker } from './core/queue/media-worker.js';

let app: FastifyInstance | null = null;
let worker: Worker | null = null;

async function main() {
  try {
    // Start HTTP server
    app = await createServer();

    await app.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    logger.info(
      { host: appConfig.host, port: appConfig.port },
      'API server started'
    );

    // Start media processing worker
    worker = createMediaWorker();
    logger.info('Media processing worker started with API server');
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down server...');
  try {
    if (worker) {
      logger.info('Closing media worker...');
      await worker.close();
    }
    if (app) {
      await app.close();
    }
    await redis.quit();
    logger.info('Server shut down gracefully');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void main();

