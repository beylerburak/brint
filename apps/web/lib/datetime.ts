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

