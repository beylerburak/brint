import Redis from 'ioredis';
import { cacheConfig } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Centralized Redis client instance
 * Configured via cacheConfig.redisUrl
 */
const redis = new Redis(cacheConfig.redisUrl);

redis.on('connect', () => {
  logger.info({ url: cacheConfig.redisUrl }, 'Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

/**
 * Check Redis health by sending a PING command
 * @returns Promise<string> - 'PONG' if healthy
 */
export async function checkRedisHealth(): Promise<string> {
  return await redis.ping();
}

export { redis };

