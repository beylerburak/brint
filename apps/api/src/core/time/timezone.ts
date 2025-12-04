/**
 * Timezone Helper Utilities
 * 
 * Handles timezone-aware date/time operations using date-fns-tz.
 * All dates are stored in UTC in the database.
 * User sees dates in their preferred timezone (workspace or personal).
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format as formatDate } from 'date-fns';
import type { User, Workspace, DateFormat, TimeFormat, TimezonePreference } from '@prisma/client';

/**
 * Resolve the effective timezone for a user
 * 
 * If user prefers LOCAL and has set their timezone, use it.
 * Otherwise, use workspace timezone.
 */
export function resolveUserTimezone(
  user: Pick<User, 'timezonePreference' | 'timezone'>,
  workspace: Pick<Workspace, 'timezone'>
): string {
  if (user.timezonePreference === 'LOCAL' && user.timezone) {
    return user.timezone;
  }
  return workspace.timezone;
}

/**
 * Get the date/time format pattern based on user preferences
 */
function getFormatPattern(dateFormat: DateFormat, timeFormat: TimeFormat): string {
  let datePattern: string;

  switch (dateFormat) {
    case 'DMY':
      datePattern = 'dd.MM.yyyy';
      break;
    case 'MDY':
      datePattern = 'MM/dd/yyyy';
      break;
    case 'YMD':
      datePattern = 'yyyy-MM-dd';
      break;
    default:
      datePattern = 'dd.MM.yyyy';
  }

  const timePattern = timeFormat === 'H24' ? 'HH:mm' : 'hh:mm a';

  return `${datePattern} ${timePattern}`;
}

/**
 * Format a UTC date for display to user in their preferred timezone and format
 * 
 * Example:
 * - UTC: 2025-12-03T15:00:00Z
 * - User in Istanbul (UTC+3): "03.12.2025 18:00"
 * - User in London (UTC+0): "03.12.2025 15:00"
 */
export function formatDateTimeForUser(options: {
  date: Date | string;
  user: Pick<User, 'timezonePreference' | 'timezone' | 'dateFormat' | 'timeFormat'>;
  workspace: Pick<Workspace, 'timezone'>;
}): string {
  const { date, user, workspace } = options;

  const utcDate = typeof date === 'string' ? new Date(date) : date;
  const tz = resolveUserTimezone(user, workspace);

  // Convert UTC to user's timezone
  const zoned = toZonedTime(utcDate, tz);

  const pattern = getFormatPattern(user.dateFormat, user.timeFormat);

  return formatDate(zoned, pattern);
}

/**
 * Format just the date part (no time) for user
 */
export function formatDateForUser(options: {
  date: Date | string;
  user: Pick<User, 'timezonePreference' | 'timezone' | 'dateFormat'>;
  workspace: Pick<Workspace, 'timezone'>;
}): string {
  const { date, user, workspace } = options;

  const utcDate = typeof date === 'string' ? new Date(date) : date;
  const tz = resolveUserTimezone(user, workspace);

  // Convert UTC to user's timezone
  const zoned = toZonedTime(utcDate, tz);

  let datePattern: string;
  switch (user.dateFormat) {
    case 'DMY':
      datePattern = 'dd.MM.yyyy';
      break;
    case 'MDY':
      datePattern = 'MM/dd/yyyy';
      break;
    case 'YMD':
      datePattern = 'yyyy-MM-dd';
      break;
    default:
      datePattern = 'dd.MM.yyyy';
  }

  return formatDate(zoned, datePattern);
}

/**
 * Format just the time part for user
 */
export function formatTimeForUser(options: {
  date: Date | string;
  user: Pick<User, 'timezonePreference' | 'timezone' | 'timeFormat'>;
  workspace: Pick<Workspace, 'timezone'>;
}): string {
  const { date, user, workspace } = options;

  const utcDate = typeof date === 'string' ? new Date(date) : date;
  const tz = resolveUserTimezone(user, workspace);

  // Convert UTC to user's timezone
  const zoned = toZonedTime(utcDate, tz);

  const timePattern = user.timeFormat === 'H24' ? 'HH:mm' : 'hh:mm a';

  return formatDate(zoned, timePattern);
}

/**
 * Parse a local date/time string entered by user into UTC for storage
 * 
 * Example:
 * - User in Istanbul selects "2025-12-03" and "18:00"
 * - We interpret as 2025-12-03T18:00 in Europe/Istanbul
 * - Convert to UTC: 2025-12-03T15:00:00Z
 * - Store in DB
 * 
 * When a user in London views this:
 * - UTC: 2025-12-03T15:00:00Z
 * - Display: "03.12.2025 15:00" (same instant, different local time)
 */
export function parseUserLocalDateTimeToUtc(options: {
  date: string;   // e.g. "2025-12-03" (YYYY-MM-DD format)
  time: string;   // e.g. "18:00" (HH:mm in 24h format)
  user: Pick<User, 'timezonePreference' | 'timezone'>;
  workspace: Pick<Workspace, 'timezone'>;
}): Date {
  const { date, time, user, workspace } = options;

  const tz = resolveUserTimezone(user, workspace);

  // Construct a local datetime string (no timezone suffix)
  // Expect time in "HH:mm" 24h format from UI
  const localDateTime = `${date}T${time}:00`;

  // Interpret localDateTime in the resolved timezone, then convert to UTC
  const utcDate = fromZonedTime(localDateTime, tz);

  return utcDate;
}

/**
 * Get current date/time in user's timezone
 * Useful for default values in forms
 */
export function getCurrentDateTimeInUserTimezone(options: {
  user: Pick<User, 'timezonePreference' | 'timezone'>;
  workspace: Pick<Workspace, 'timezone'>;
}): { date: string; time: string } {
  const { user, workspace } = options;
  
  const tz = resolveUserTimezone(user, workspace);
  const now = new Date();
  const zoned = toZonedTime(now, tz);

  return {
    date: formatDate(zoned, 'yyyy-MM-dd'),
    time: formatDate(zoned, 'HH:mm'),
  };
}

