"use client";

import { useState, useRef, useEffect } from "react";
import { checkUsernameAvailability } from "@/features/space/api/user-api";
import { logger } from "@/shared/utils/logger";

interface UseUsernameAvailabilityOptions {
  /** Current profile username to skip check when unchanged */
  currentUsername?: string | null;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Whether the check is enabled */
  enabled?: boolean;
}

interface UseUsernameAvailabilityReturn {
  /** Is the username available? null if not yet checked */
  isAvailable: boolean | null;
  /** Is the check in progress? */
  isChecking: boolean;
  /** Check a specific username */
  checkUsername: (username: string) => void;
  /** Reset the availability state */
  reset: () => void;
}

export function useUsernameAvailability(
  options: UseUsernameAvailabilityOptions = {}
): UseUsernameAvailabilityReturn {
  const { currentUsername, debounceMs = 500, enabled = true } = options;

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkUsername = (username: string) => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Don't check if disabled
    if (!enabled) {
      setIsAvailable(null);
      return;
    }

    // Don't check if username is empty
    if (!username?.trim()) {
      setIsAvailable(null);
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();

    // Don't check if it's the same as current username
    if (currentUsername === normalizedUsername) {
      setIsAvailable(true);
      return;
    }

    // Start checking
    setIsChecking(true);
    abortControllerRef.current = new AbortController();

    timeoutRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(normalizedUsername);
        setIsAvailable(available);
      } catch (error) {
        // Silently handle 401 errors - user might not be authenticated
        if (error instanceof Error && error.message.includes("401")) {
          setIsAvailable(null);
          return;
        }
        logger.error("Error checking username availability:", error);
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, debounceMs);
  };

  const reset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAvailable(null);
    setIsChecking(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isAvailable,
    isChecking,
    checkUsername,
    reset,
  };
}

