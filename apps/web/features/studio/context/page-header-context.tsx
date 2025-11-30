"use client";

import * as React from "react";

export interface StudioPageHeaderConfig {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

interface StudioPageHeaderContextValue {
  config: StudioPageHeaderConfig | null;
  setConfig: (config: StudioPageHeaderConfig | null) => void;
}

const StudioPageHeaderContext = React.createContext<StudioPageHeaderContextValue | null>(null);

export function StudioPageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<StudioPageHeaderConfig | null>(null);

  const value = React.useMemo(() => ({ config, setConfig }), [config]);

  return (
    <StudioPageHeaderContext.Provider value={value}>
      {children}
    </StudioPageHeaderContext.Provider>
  );
}

export function useStudioPageHeaderContext() {
  const context = React.useContext(StudioPageHeaderContext);
  if (!context) {
    throw new Error("useStudioPageHeaderContext must be used within StudioPageHeaderProvider");
  }
  return context;
}

/**
 * Hook for studio pages to set their header configuration
 * Accepts a memoized config object to prevent unnecessary re-renders
 * 
 * @example
 * const headerConfig = useMemo(() => ({
 *   title: "Social Accounts",
 *   description: "Manage social accounts for this brand.",
 *   badge: <Badge>{count}</Badge>,
 *   actions: <Button>Connect Account</Button>
 * }), [count]);
 * useStudioPageHeader(headerConfig);
 */
export function useStudioPageHeader(config: StudioPageHeaderConfig) {
  const { setConfig } = useStudioPageHeaderContext();

  React.useEffect(() => {
    setConfig(config);
    return () => setConfig(null);
  }, [config, setConfig]);
}

