import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { appConfig } from '../config/index.js';

export default fp(async function cookiePlugin(app: FastifyInstance) {
  await app.register(cookie, {
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax', // OAuth redirect için 'strict' sıkıntılı olabilir
      secure: appConfig.env === 'production',
      path: '/',
    },
  });
});

