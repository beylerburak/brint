import Fastify from 'fastify';

// TODO: TS-06/TS-07 ile env/config'e taşınacak
const PORT = 4000;

const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get('/health/basic', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT });
    console.log(`Server listening on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

