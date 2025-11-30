"use client";

import * as React from "react";

export interface PageHeaderConfig {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

interface PageHeaderContextValue {
  config: PageHeaderConfig | null;
  setConfig: (config: PageHeaderConfig | null) => void;
}

const PageHeaderContext = React.createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<PageHeaderConfig | null>(null);

  const value = React.useMemo(() => ({ config, setConfig }), [config]);

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderContext() {
  const context = React.useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeaderContext must be used within PageHeaderProvider");
  }
  return context;
}

/**
 * Hook for pages to set their header configuration
 * Accepts a memoized config object to prevent unnecessary re-renders
 * 
 * @example
 * const headerConfig = useMemo(() => ({
 *   title: "Brands",
 *   description: "Manage your brands and their information.",
 *   badge: <Badge>{count}</Badge>,
 *   actions: <Button>Add Brand</Button>
 * }), [count]);
 * usePageHeader(headerConfig);
 * 
 * // Or for static configs:
 * usePageHeader(useMemo(() => ({
 *   title: "Dashboard",
 *   description: "Welcome to your dashboard",
 * }), []));
 */
export function usePageHeader(config: PageHeaderConfig) {
  const { setConfig } = usePageHeaderContext();

  React.useEffect(() => {
    setConfig(config);
    return () => setConfig(null);
  }, [config, setConfig]);
}

// Keep backward compatibility alias
export const usePageHeaderMemo = usePageHeader;
