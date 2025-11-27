"use client";

import React from "react";
import { useHasPermission, useAnyPermission } from "./hooks";
import type { Permission } from "./permission-context";

interface PermissionGateProps {
  permission: Permission | Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * PermissionGate component conditionally renders children based on permissions
 * - If a single permission is provided, checks that permission
 * - If an array is provided, uses OR logic (user needs at least one)
 * - If permission is granted, renders children
 * - Otherwise, renders fallback (or null if no fallback provided)
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const hasPermission = Array.isArray(permission)
    ? useAnyPermission(permission)
    : useHasPermission(permission);

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

