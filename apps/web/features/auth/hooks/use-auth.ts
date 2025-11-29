"use client";

import { useContext } from "react";
import { AuthContext } from "../context/auth-context";

/**
 * Hook to access authentication state and methods.
 * Must be used within an AuthProvider.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <LoginForm />;
 * }
 *
 * return <div>Welcome, {user.name}</div>;
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

