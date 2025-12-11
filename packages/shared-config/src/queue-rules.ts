/**
 * Queue Rules & Limits
 *
 * Shared configuration for BullMQ queue behavior, rate limits, and concurrency.
 * Single source of truth for queue-related settings.
 */

export interface QueueRateLimitConfig {
  /** Maximum number of jobs allowed within the duration */
  max: number;
  /** Duration in milliseconds for rate limiting */
  durationMs: number;
  /** Maximum concurrent jobs for the worker */
  concurrency: number;
}

/**
 * Publication queue configuration
 * - Rate limit: 50 jobs per 1 second
 * - Concurrency: 5 concurrent publications
 * - Conservative limits to respect platform APIs
 */
export const PUBLICATION_QUEUE_RULES: QueueRateLimitConfig = {
  max: 50,
  durationMs: 1000,
  concurrency: 5,
};