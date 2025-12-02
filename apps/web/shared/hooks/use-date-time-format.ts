/**
 * Hook for date/time formatting based on user preferences
 */

import { useCallback } from "react";
import { formatDate, formatTime, formatDateTime, formatDateShort } from "@/shared/lib/date-time-format";

export interface UseDateTimeFormatOptions {
  dateFormat?: string;
  timeFormat?: string;
  locale?: string;
}

/**
 * Hook that provides date/time formatting functions with user preferences
 * 
 * @param options - User preferences (dateFormat, timeFormat, locale)
 * @returns Formatting functions bound to user preferences
 * 
 * @example
 * ```tsx
 * const { formatDate, formatTime, formatDateTime } = useDateTimeFormat({
 *   dateFormat: user.dateFormat,
 *   timeFormat: user.timeFormat,
 * });
 * 
 * <p>{formatDate(publication.scheduledAt)}</p>
 * <p>{formatTime(publication.scheduledAt)}</p>
 * <p>{formatDateTime(publication.scheduledAt)}</p>
 * ```
 */
export function useDateTimeFormat(options: UseDateTimeFormatOptions = {}) {
  const { dateFormat, timeFormat, locale } = options;

  const formatDateFn = useCallback(
    (date: Date | string | number) => {
      return formatDate(date, dateFormat);
    },
    [dateFormat]
  );

  const formatTimeFn = useCallback(
    (date: Date | string | number) => {
      return formatTime(date, timeFormat);
    },
    [timeFormat]
  );

  const formatDateTimeFn = useCallback(
    (date: Date | string | number, separator?: string) => {
      return formatDateTime(date, dateFormat, timeFormat, separator);
    },
    [dateFormat, timeFormat]
  );

  const formatDateShortFn = useCallback(
    (date: Date | string | number) => {
      return formatDateShort(date, locale);
    },
    [locale]
  );

  return {
    formatDate: formatDateFn,
    formatTime: formatTimeFn,
    formatDateTime: formatDateTimeFn,
    formatDateShort: formatDateShortFn,
  };
}

