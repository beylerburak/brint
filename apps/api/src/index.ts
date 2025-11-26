import Fastify from 'fastify';
import { env } from './config/env.js';

const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get('/health/basic', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
    console.log(`Server listening on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

