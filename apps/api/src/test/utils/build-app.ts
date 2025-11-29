import type { FastifyInstance } from 'fastify';
import { createServer } from '../../core/http/server.js';

/**
 * Creates a Fastify server instance for testing
 * This helper ensures the server is properly initialized with all plugins and routes
 */
export async function buildAppForTest(): Promise<FastifyInstance> {
  const app = await createServer();
  await app.ready();
  return app;
}

