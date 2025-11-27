"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  verifyMagicLink,
  logout as logoutApi,
  getCurrentSession,
  type MagicLinkVerifyResult,
} from "@/features/auth/api/auth-api";
import { setAccessToken, clearAccessToken, getAccessToken } from "@/shared/auth/token-storage";
import { onUnauthenticated } from "@/shared/http";
import type { LoginResult } from "@/features/auth/api/auth-api";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (result: LoginResult) => Promise<void>;
  loginWithSession: (result: LoginResult) => Promise<void>;
  logout: () => Promise<void>;
  verifyMagicLinkToken: (token: string) => Promise<LoginResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = "auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
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
          }
        } catch (error) {
          console.error("Error restoring session:", error);
          clearAccessToken();
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }

      setLoading(false);
    };

    initializeAuth();

    // Listen for unauthenticated events (from HTTP client)
    const unsubscribe = onUnauthenticated(() => {
      // Clear auth state and redirect to login
      setUser(null);
      clearAccessToken();
      localStorage.removeItem(AUTH_STORAGE_KEY);
      const locale = window.location.pathname.split("/")[1] || "en";
      router.push(locale === "en" ? "/login" : `/${locale}/login`);
    });

    return unsubscribe;
  }, [router]);

  const login = async (result: LoginResult) => {
    setUser(result.user);
    setAccessToken(result.accessToken);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
  };

  const loginWithSession = async (result: LoginResult) => {
    // Same as login, but explicitly named for session-based login
    await login(result);
  };

  const verifyMagicLinkToken = async (
    token: string
  ): Promise<LoginResult & { verifyData?: MagicLinkVerifyResult }> => {
    const result = await verifyMagicLink(token);
    await login(result);
    return result;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      // Log error but continue with local logout
      console.error("Logout API call failed:", error);
    } finally {
      setUser(null);
      clearAccessToken();
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    loading,
    login,
    loginWithSession,
    logout,
    verifyMagicLinkToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
