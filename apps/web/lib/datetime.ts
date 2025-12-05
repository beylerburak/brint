/**
 * Frontend DateTime Helper Types
 * 
 * Type definitions for handling local date/time inputs.
 * Backend handles all timezone conversions.
 */

/**
 * Local date and time input format
 * Used when submitting date/time data to the backend
 */
export type LocalDateTimeInput = {
  date: string; // "2025-12-03" (YYYY-MM-DD format)
  time: string; // "18:00" (HH:mm in 24h format)
};

/**
 * User timezone preference enum (mirrors backend)
 */
export enum TimezonePreference {
  WORKSPACE = 'WORKSPACE',
  LOCAL = 'LOCAL',
}

/**
 * Date format enum (mirrors backend)
 */
export enum DateFormat {
  DMY = 'DMY',   // 31.12.2025
  MDY = 'MDY',   // 12/31/2025
  YMD = 'YMD',   // 2025-12-31
}

/**
 * Time format enum (mirrors backend)
 */
export enum TimeFormat {
  H24 = 'H24',   // 23:45
  H12 = 'H12',   // 11:45 PM
}

/**
 * User preferences type
 */
export type UserPreferences = {
  timezonePreference: TimezonePreference;
  timezone?: string | null;
  locale?: string | null;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
};

/**
 * Helper to get current local date/time in input format
 */
export function getCurrentLocalDateTime(): LocalDateTimeInput {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

/**
 * Helper to format date for display (before backend processing)
 * For actual display of stored dates, use backend-formatted values from API
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Helper to format time for input (before backend processing)
 */
export function formatTimeForInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Format date according to user preference
 */
export function formatDateByPreference(
  date: Date | string,
  dateFormat: DateFormat = DateFormat.MDY
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  
  switch (dateFormat) {
    case DateFormat.DMY:
      return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    case DateFormat.YMD:
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case DateFormat.MDY:
    default:
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
  }
}

/**
 * Format time according to user preference
 */
export function formatTimeByPreference(
  date: Date | string,
  timeFormat: TimeFormat = TimeFormat.H24
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const minutesStr = String(minutes).padStart(2, '0');
  
  if (timeFormat === TimeFormat.H12) {
    const hours12 = hours24 % 12 || 12;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    return `${hours12}:${minutesStr} ${period}`;
  } else {
    // H24
    return `${String(hours24).padStart(2, '0')}:${minutesStr}`;
  }
}

/**
 * Format date and time together according to user preferences
 */
export function formatDateTimeByPreference(
  date: Date | string,
  dateFormat: DateFormat = DateFormat.MDY,
  timeFormat: TimeFormat = TimeFormat.H24,
  separator: string = ' '
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const formattedDate = formatDateByPreference(d, dateFormat);
  const formattedTime = formatTimeByPreference(d, timeFormat);
  
  return `${formattedDate}${separator}${formattedTime}`;
}

/**
 * Format date in short format (without year if current year)
 */
export function formatDateShort(
  date: Date | string,
  locale: string = 'en-US'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  
  // Add year if different from current year
  if (d.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  
  return d.toLocaleDateString(locale, options);
}

/**
 * Format time in short format
 */
export function formatTimeShort(
  date: Date | string,
  timeFormat: TimeFormat = TimeFormat.H24
): string {
  return formatTimeByPreference(date, timeFormat);
}

