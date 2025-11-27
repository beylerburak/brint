"use client";

import React from "react";
import { useAnyPermission } from "../hooks/hooks";
import type { PermissionKey } from "../permission-keys";

interface PermissionGateProps {
  permission: PermissionKey | PermissionKey[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * PermissionGate component conditionally renders children based on permissions
 * Uses only backend permission snapshot - no owner bypass
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
  const permissionList = Array.isArray(permission) ? permission : [permission];
  const hasPermission = useAnyPermission(permissionList);

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
