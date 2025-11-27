/**
 * Global API cache to prevent duplicate requests across components
 * This is especially important in React Strict Mode where components mount twice
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 30000; // 30 seconds

  /**
   * Get cached data or execute fetch function
   * If multiple calls happen simultaneously, they share the same promise
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    // Return cached data if still valid
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data;
    }

    // If there's an ongoing request, return its promise
    if (cached?.promise) {
      return cached.promise;
    }

    // Create new request
    const promise = fetchFn().then((data) => {
      // Cache the result
      this.cache.set(key, {
        data,
        timestamp: now,
      });
      return data;
    });

    // Store promise in cache while request is in flight
    this.cache.set(key, {
      data: cached?.data as T,
      timestamp: cached?.timestamp || 0,
      promise,
    });

    return promise;
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for debugging)
   */
  size(): number {
    return this.cache.size;
  }
}

export const apiCache = new ApiCache();

