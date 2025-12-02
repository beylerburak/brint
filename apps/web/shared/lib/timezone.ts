/**
 * Timezone utilities for scheduling content publications
 * 
 * Converts local date/time inputs to UTC ISO strings using brand/user timezone.
 */

import { fromZonedTime } from "date-fns-tz";

/**
 * Build publishAt ISO string from date/time inputs and timezone
 * 
 * @param date - Date string in "YYYY-MM-DD" format (from date input)
 * @param time - Time string in "HH:mm" format (from time input)
 * @param timezone - IANA timezone string (e.g. "Europe/Istanbul", "America/New_York")
 *                   If not provided, falls back to browser timezone
 * @returns ISO string in UTC, or undefined if inputs are invalid
 * 
 * @example
 * ```ts
 * // User selects: Dec 10, 2025, 15:00 in Istanbul
 * buildPublishAtISO("2025-12-10", "15:00", "Europe/Istanbul")
 * // Returns: "2025-12-10T12:00:00.000Z" (UTC)
 * ```
 */
export function buildPublishAtISO(
  date: string,
  time: string,
  timezone?: string
): string | undefined {
  if (!date || !time) {
    return undefined;
  }

  // Use provided timezone or fallback to browser timezone
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    // Parse date and time components
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a plain Date object with local components
    // This Date object represents the local time we want to interpret in the target timezone
    const localDateTime = new Date(year, month - 1, day, hours, minutes, 0);
    
    // Convert from the specified timezone to UTC
    // fromZonedTime interprets localDateTime as being in the specified timezone
    const utcDate = fromZonedTime(localDateTime, tz);
    
    // Return ISO string
    return utcDate.toISOString();
  } catch (e) {
    console.warn("Invalid date/time or timezone", {
      date,
      time,
      tz,
      error: e instanceof Error ? e.message : String(e),
    });
    return undefined;
  }
}

/**
 * Get effective timezone from brand/user
 * 
 * Priority order:
 * 1. Brand timezone (if set)
 * 2. User timezone (always set, defaults to "UTC")
 * 3. Browser timezone (fallback if both above are missing - shouldn't happen)
 * 
 * @param brandTimezone - Brand's IANA timezone (optional)
 * @param userTimezone - User's IANA timezone (should always be set)
 * @returns IANA timezone string
 */
export function getEffectiveTimezone(
  brandTimezone?: string | null,
  userTimezone?: string | null
): string {
  return (
    brandTimezone ||
    userTimezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

