import Fastify from 'fastify';
import { appConfig } from './config/index.js';

const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get('/health/basic', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: appConfig.port, host: appConfig.host });
    console.log(`Server listening on http://${appConfig.host}:${appConfig.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

