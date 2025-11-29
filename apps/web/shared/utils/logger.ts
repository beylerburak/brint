const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

/**
 * Centralized logger utility
 * - Dev/Test: All log levels enabled
 * - Production: Only error logs enabled
 */
export const logger = {
  debug: (...args: any[]) => {
    if (isDev || isTest) {
      console.debug("[DEBUG]", ...args);
    }
  },

  info: (...args: any[]) => {
    if (isDev || isTest) {
      console.info("[INFO]", ...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDev || isTest) {
      console.warn("[WARN]", ...args);
    }
  },

  error: (...args: any[]) => {
    // Error logs should always be visible, even in production
    console.error("[ERROR]", ...args);
  },
};

