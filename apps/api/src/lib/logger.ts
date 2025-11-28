import pino from 'pino';
import type { FastifyBaseLogger } from 'fastify';
import { appConfig } from '../config/index.js';

/**
 * Centralized logger instance
 * Uses pino for structured logging
 * Configured via appConfig.logLevel
 */
export const logger: FastifyBaseLogger = pino({
  level: appConfig.logLevel,
  base: {
    service: 'api',
  },
});

export type Logger = typeof logger;
