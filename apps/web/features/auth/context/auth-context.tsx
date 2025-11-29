"use client";

import React, { createContext, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import {
  verifyMagicLink,
  logout as logoutApi,
  getCurrentSession,
  type MagicLinkVerifyResult,
} from "@/features/auth/api/auth-api";
import { setAccessToken, clearAccessToken, getAccessToken } from "@/shared/auth/token-storage";
import { onUnauthenticated } from "@/shared/http";
import { apiCache } from "@/shared/api/cache";
import type { LoginResult } from "@/features/auth/api/auth-api";
import { logger } from "@/shared/utils/logger";
import type { AuthUser, AuthContextValue } from "../types";

// Re-export types for convenience
export type { AuthUser, AuthContextValue };

// Export context for use by useAuth hook
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = "auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenReady, setTokenReady] = useState(false);
  const router = useRouter();

  // Initialize from localStorage and check session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Load user from localStorage
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        try {
          const parsedUser = JSON.parse(stored) as AuthUser;
          setUser(parsedUser);
        } catch {
          // Invalid stored data, clear it
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }

      // Check if we have a token and try to restore session
      const token = getAccessToken();
      if (token) {
        try {
          const session = await getCurrentSession();
          if (session) {
            setUser(session.user);
            setTokenReady(true);
            // Subscription info is now included in /auth/me response, no need to prefetch
          } else {
            setTokenReady(false);
          }
        } catch (error) {
          logger.error("Error restoring session:", error);
          clearAccessToken();
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setTokenReady(false);
        }
      } else {
        setTokenReady(false);
      }

      setLoading(false);
    };

    initializeAuth();

    // Listen for unauthenticated events (from HTTP client)
    const unsubscribe = onUnauthenticated(() => {
      // Clear auth state and redirect to login
      setUser(null);
      clearAccessToken();
      setTokenReady(false);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      // Clear API cache on unauthenticated
      apiCache.invalidate("session:current");
      apiCache.invalidate("user:profile");
      const locale = window.location.pathname.split("/")[1] || "en";
      router.push(locale === "en" ? "/login" : `/${locale}/login`);
    });

    return unsubscribe;
  }, [router]);

  const login = useCallback(async (result: LoginResult) => {
    setUser(result.user);
    setAccessToken(result.accessToken);
    setTokenReady(true);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
    
    // Set user context in Sentry
    Sentry.setUser({
      id: result.user.id,
      email: result.user.email,
      username: result.user.name,
    });
    
    // Clear cache on login to force fresh data fetch
    apiCache.invalidate("session:current");
    apiCache.invalidate("user:profile");
    // Subscription info will be fetched with next getCurrentSession() call
  }, []);

  const loginWithSession = useCallback(async (result: LoginResult) => {
    // Same as login, but explicitly named for session-based login
    await login(result);
  }, [login]);

  const verifyMagicLinkToken = useCallback(async (
    token: string
  ): Promise<LoginResult & { verifyData?: MagicLinkVerifyResult }> => {
    const result = await verifyMagicLink(token);
    await login(result);
    return result;
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (error) {
      // Log error but continue with local logout
      logger.error("Logout API call failed:", error);
    } finally {
      setUser(null);
      clearAccessToken();
      setTokenReady(false);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      
      // Clear user context in Sentry
      Sentry.setUser(null);
      
      // Clear API cache on logout
      apiCache.invalidate("session:current");
      apiCache.invalidate("user:profile");
    }
  }, []);

  const accessToken = getAccessToken();

  const value: AuthContextValue = useMemo(() => ({
    user,
    isAuthenticated: user !== null,
    loading,
    accessToken,
    tokenReady,
    login,
    loginWithSession,
    logout,
    verifyMagicLinkToken,
  }), [user, loading, accessToken, tokenReady, login, loginWithSession, logout, verifyMagicLinkToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Re-export useAuth from hooks for backward compatibility
export { useAuth } from "../hooks/use-auth";

