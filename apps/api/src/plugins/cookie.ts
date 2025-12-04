import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { appConfig } from '../config/index.js';

export default fp(async function cookiePlugin(app: FastifyInstance) {
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'cookie-secret-change-in-production',
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.env === 'production',
      path: '/',
    },
  });
});

