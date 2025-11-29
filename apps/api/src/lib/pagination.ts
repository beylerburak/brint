/**
 * Pagination Utilities
 * 
 * Common pagination helpers for cursor-based pagination.
 * Based on the pattern used in Activity module.
 */

export interface CursorPaginationInput {
  /**
   * Maximum number of items to return per page
   * Default: 50
   * Maximum: 100
   */
  limit?: number;
  /**
   * Cursor for pagination (typically an ID or timestamp)
   * If provided, returns items after this cursor
   */
  cursor?: string | null;
  /**
   * Maximum allowed limit value
   * Default: 100
   */
  maxLimit?: number;
  /**
   * Default limit value if not provided
   * Default: 50
   */
  defaultLimit?: number;
}

export interface CursorPaginationResult<TItem> {
  /**
   * Array of items for the current page
   */
  items: TItem[];
  /**
   * Cursor for the next page
   * null if there are no more pages
   */
  nextCursor: string | null;
}

export interface NormalizedCursorPaginationInput {
  /**
   * Normalized limit value (clamped to maxLimit)
   */
  limit: number;
  /**
   * Cursor value (null if not provided)
   */
  cursor: string | null;
}

/**
 * Normalizes cursor pagination input
 * - Applies default limit if not provided
 * - Clamps limit to maxLimit
 * - Ensures limit is at least 1
 * 
 * @param input - Raw pagination input
 * @returns Normalized pagination input
 */
export function normalizeCursorPaginationInput(
  input: CursorPaginationInput
): NormalizedCursorPaginationInput {
  const defaultLimit = input.defaultLimit ?? 50;
  const maxLimit = input.maxLimit ?? 100;
  
  let limit = input.limit ?? defaultLimit;
  
  // Ensure limit is at least 1
  if (limit < 1) {
    limit = defaultLimit;
  }
  
  // Clamp to maxLimit
  if (limit > maxLimit) {
    limit = maxLimit;
  }
  
  return {
    limit,
    cursor: input.cursor ?? null,
  };
}

/**
 * Creates a paginated result from a list of items
 * Uses the "take + 1" pattern to detect if there's a next page
 * 
 * @param items - Array of items (should be limit + 1 in length if there's a next page)
 * @param limit - Requested limit (used to detect if there's a next page)
 * @param getCursor - Function to extract cursor from an item (typically returns item.id)
 * @returns Paginated result with items and nextCursor
 * 
 * @example
 * ```typescript
 * const events = await prisma.activityEvent.findMany({
 *   take: normalizedLimit + 1,
 *   // ...
 * });
 * 
 * const result = createCursorPaginationResult(
 *   events,
 *   normalizedLimit,
 *   (event) => event.id
 * );
 * 
 * return {
 *   items: result.items,
 *   nextCursor: result.nextCursor,
 * };
 * ```
 */
export function createCursorPaginationResult<TItem>(
  items: TItem[],
  limit: number,
  getCursor: (item: TItem) => string
): CursorPaginationResult<TItem> {
  let nextCursor: string | null = null;
  
  // If we fetched more than requested, there's a next page
  if (items.length > limit) {
    const nextItem = items[items.length - 1];
    nextCursor = getCursor(nextItem);
    items = items.slice(0, limit); // Remove the extra item
  }
  
  return {
    items,
    nextCursor,
  };
}

/**
 * Helper to get the "take" value for Prisma queries
 * Use this with the "take + 1" pattern for cursor pagination
 * 
 * @param limit - Normalized limit value
 * @returns limit + 1 (for detecting next page)
 */
export function getPrismaTakeValue(limit: number): number {
  return limit + 1;
}

