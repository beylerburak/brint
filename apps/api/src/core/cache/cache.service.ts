/**
 * Cache Service
 * 
 * Centralized caching service using Redis
 * Provides get, set, delete operations with TTL support
 */

import { redis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';

export class CacheService {
  /**
   * Get cached value
   * Automatically converts date strings back to Date objects
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      const normalized = this.normalizeDates(parsed);
      
      logger.debug({ key }, 'Cache HIT');
      return normalized as T;
    } catch (error) {
      logger.error({ error, key }, 'Cache GET error');
      return null;
    }
  }

  /**
   * Recursively normalize date strings back to Date objects
   * Looks for common date field names and ISO date strings
   */
  private normalizeDates(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeDates(item));
    }

    if (typeof obj === 'object') {
      const normalized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Check if this is a date field (common Prisma date field names)
        if (
          typeof value === 'string' &&
          (key.includes('At') || key.includes('Date') || key === 'createdAt' || key === 'updatedAt') &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
        ) {
          // Try to parse as ISO date string
          const dateValue = new Date(value);
          if (!isNaN(dateValue.getTime())) {
            normalized[key] = dateValue;
          } else {
            normalized[key] = value;
          }
        } else if (typeof value === 'object' && value !== null) {
          // Recursively normalize nested objects
          normalized[key] = this.normalizeDates(value);
        } else {
          normalized[key] = value;
        }
      }
      
      return normalized;
    }

    return obj;
  }

  /**
   * Set cached value with optional TTL (in seconds)
   * Default TTL: 5 minutes
   */
  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
      logger.debug({ key, ttl: ttlSeconds }, 'Cache SET');
    } catch (error) {
      logger.error({ error, key }, 'Cache SET error');
    }
  }

  /**
   * Delete cached value(s)
   * Supports pattern matching with *
   */
  async delete(keyOrPattern: string): Promise<void> {
    try {
      // If pattern contains *, use scan + del
      if (keyOrPattern.includes('*')) {
        const keys = await this.scanKeys(keyOrPattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.debug({ pattern: keyOrPattern, count: keys.length }, 'Cache DELETE (pattern)');
        }
      } else {
        await redis.del(keyOrPattern);
        logger.debug({ key: keyOrPattern }, 'Cache DELETE');
      }
    } catch (error) {
      logger.error({ error, key: keyOrPattern }, 'Cache DELETE error');
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Cache EXISTS error');
      return false;
    }
  }

  /**
   * Get remaining TTL for a key (in seconds)
   * Returns -1 if key doesn't exist, -2 if key has no expiry
   */
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache TTL error');
      return -1;
    }
  }

  /**
   * Scan keys matching pattern (SCAN is cursor-based, memory efficient)
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, scannedKeys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...scannedKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clearAll(): Promise<void> {
    try {
      await redis.flushdb();
      logger.warn('Cache FLUSH ALL');
    } catch (error) {
      logger.error({ error }, 'Cache FLUSH ALL error');
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

/**
 * Cache key builders for consistency
 */
export const CacheKeys = {
  // Brand keys
  brand: (brandId: string) => `brand:${brandId}`,
  brandsList: (workspaceId: string, status?: string) => 
    `brands:${workspaceId}:${status || 'all'}`,
  brandProfile: (brandId: string) => `brand:${brandId}:profile`,
  brandContacts: (brandId: string) => `brand:${brandId}:contacts`,

  // Workspace keys
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  workspacesList: (userId: string) => `workspaces:user:${userId}`,

  // User keys
  user: (userId: string) => `user:${userId}`,
  userMe: (userId: string) => `user:${userId}:me`,

  // Pattern matchers for bulk delete
  patterns: {
    allBrands: (workspaceId: string) => `brands:${workspaceId}:*`,
    allBrandData: (brandId: string) => `brand:${brandId}*`,
  },
};

