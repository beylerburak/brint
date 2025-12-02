/**
 * Date and Time Formatting Utilities
 * 
 * Provides consistent date/time formatting across the app based on user preferences.
 */

import { format as dateFnsFormat } from "date-fns";

// ============================================================================
// Format Constants
// ============================================================================

/**
 * Available date formats
 */
export const DATE_FORMATS = {
  "DD/MM/YYYY": "dd/MM/yyyy",      // European (18/12/2025)
  "MM/DD/YYYY": "MM/dd/yyyy",      // US (12/18/2025)
  "YYYY-MM-DD": "yyyy-MM-dd",      // ISO (2025-12-18)
  "DD.MM.YYYY": "dd.MM.yyyy",      // German (18.12.2025)
  "DD MMM YYYY": "dd MMM yyyy",    // 18 Dec 2025
} as const;

export type DateFormatKey = keyof typeof DATE_FORMATS;

/**
 * Available time formats
 */
export const TIME_FORMATS = {
  "12h": "h:mm a",   // 3:00 PM
  "24h": "HH:mm",    // 15:00
} as const;

export type TimeFormatKey = keyof typeof TIME_FORMATS;

/**
 * Date format display labels for UI
 */
export const DATE_FORMAT_LABELS: Record<DateFormatKey, string> = {
  "DD/MM/YYYY": "DD/MM/YYYY (18/12/2025)",
  "MM/DD/YYYY": "MM/DD/YYYY (12/18/2025)",
  "YYYY-MM-DD": "YYYY-MM-DD (2025-12-18)",
  "DD.MM.YYYY": "DD.MM.YYYY (18.12.2025)",
  "DD MMM YYYY": "DD MMM YYYY (18 Dec 2025)",
};

/**
 * Time format display labels for UI
 */
export const TIME_FORMAT_LABELS: Record<TimeFormatKey, string> = {
  "12h": "12-hour (3:00 PM)",
  "24h": "24-hour (15:00)",
};

// ============================================================================
// Format Functions
// ============================================================================

/**
 * Format a date according to user preference
 * 
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param userDateFormat - User's preferred date format (from profile)
 * @returns Formatted date string
 * 
 * @example
 * ```ts
 * formatDate(new Date(), "DD/MM/YYYY") // "18/12/2025"
 * formatDate(new Date(), "MM/DD/YYYY") // "12/18/2025"
 * ```
 */
export function formatDate(
  date: Date | string | number,
  userDateFormat?: string
): string {
  const dateObj = typeof date === "string" || typeof date === "number" 
    ? new Date(date) 
    : date;
  
  const formatKey = (userDateFormat || "DD/MM/YYYY") as DateFormatKey;
  const formatString = DATE_FORMATS[formatKey] || DATE_FORMATS["DD/MM/YYYY"];
  
  try {
    return dateFnsFormat(dateObj, formatString);
  } catch (error) {
    console.warn("Date formatting error:", error);
    return dateFnsFormat(dateObj, DATE_FORMATS["DD/MM/YYYY"]);
  }
}

/**
 * Format a time according to user preference
 * 
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param userTimeFormat - User's preferred time format (from profile)
 * @returns Formatted time string
 * 
 * @example
 * ```ts
 * formatTime(new Date(), "12h") // "3:00 PM"
 * formatTime(new Date(), "24h") // "15:00"
 * ```
 */
export function formatTime(
  date: Date | string | number,
  userTimeFormat?: string
): string {
  const dateObj = typeof date === "string" || typeof date === "number" 
    ? new Date(date) 
    : date;
  
  const formatKey = (userTimeFormat || "24h") as TimeFormatKey;
  const formatString = TIME_FORMATS[formatKey] || TIME_FORMATS["24h"];
  
  try {
    return dateFnsFormat(dateObj, formatString);
  } catch (error) {
    console.warn("Time formatting error:", error);
    return dateFnsFormat(dateObj, TIME_FORMATS["24h"]);
  }
}

/**
 * Format a date and time together
 * 
 * @param date - Date to format
 * @param userDateFormat - User's preferred date format
 * @param userTimeFormat - User's preferred time format
 * @param separator - Separator between date and time (default: ", ")
 * @returns Formatted datetime string
 * 
 * @example
 * ```ts
 * formatDateTime(new Date(), "DD/MM/YYYY", "12h") // "18/12/2025, 3:00 PM"
 * formatDateTime(new Date(), "YYYY-MM-DD", "24h") // "2025-12-18, 15:00"
 * ```
 */
export function formatDateTime(
  date: Date | string | number,
  userDateFormat?: string,
  userTimeFormat?: string,
  separator: string = ", "
): string {
  const formattedDate = formatDate(date, userDateFormat);
  const formattedTime = formatTime(date, userTimeFormat);
  return `${formattedDate}${separator}${formattedTime}`;
}

/**
 * Format a date in short format (e.g., for calendar previews)
 * 
 * @param date - Date to format
 * @param userDateFormat - User's preferred date format
 * @returns Formatted short date string
 * 
 * @example
 * ```ts
 * formatDateShort(new Date()) // "18 Dec" (localized)
 * ```
 */
export function formatDateShort(
  date: Date | string | number,
  locale: string = "en"
): string {
  const dateObj = typeof date === "string" || typeof date === "number" 
    ? new Date(date) 
    : date;
  
  try {
    return dateFnsFormat(dateObj, "d MMM");
  } catch (error) {
    console.warn("Date formatting error:", error);
    return dateFnsFormat(dateObj, "d MMM");
  }
}

