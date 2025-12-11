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

/**
 * Cache helper functions
 */

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to get cache');
    return null;
  }
}

/**
 * Set cached value with TTL (time to live in seconds)
 */
export async function setCache<T>(key: string, value: T, ttl: number = 300): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to set cache');
  }
}

/**
 * Delete cache by key
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to delete cache');
  }
}

/**
 * Delete cache by pattern (e.g., "brands:workspace:*")
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error({ err: error, pattern }, 'Failed to delete cache pattern');
  }
}

export { redis };

