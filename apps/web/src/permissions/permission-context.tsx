"use client";

import React, { createContext, useContext, useState } from "react";

export type Permission = string;

interface PermissionContextValue {
  permissions: Permission[];
  setPermissions: (p: Permission[]) => void;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(
  undefined
);

// Mock permissions for TS-33
// Real API integration will come in TS-40
const mockPermissions: Permission[] = [
  "studio:brand.view",
  "studio:content.create",
  "workspace:settings.view",
];

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permissions, setPermissions] = useState<Permission[]>(mockPermissions);

  return (
    <PermissionContext.Provider value={{ permissions, setPermissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error(
      "usePermissionContext must be used within a PermissionProvider"
    );
  }
  return context;
}

