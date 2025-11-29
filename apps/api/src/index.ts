import { FastifyInstance } from 'fastify';
import { appConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { createServer } from './core/http/server.js';
// Bootstrap email queue worker
import './core/queue/email.queue.js';

let app: FastifyInstance | null = null;

async function main() {
  try {
    app = await createServer();

    await app.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    logger.info(
      { host: appConfig.host, port: appConfig.port },
      'API server started'
    );
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down server...');
  try {
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

