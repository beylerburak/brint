"use client";

import * as React from "react";

export interface StudioPageHeaderConfig {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

interface StudioPageHeaderContextValue {
  configRef: React.MutableRefObject<StudioPageHeaderConfig | null>;
  version: number;
  setConfig: (config: StudioPageHeaderConfig | null) => void;
}

const StudioPageHeaderContext = React.createContext<StudioPageHeaderContextValue | null>(null);

export function StudioPageHeaderProvider({ children }: { children: React.ReactNode }) {
  // Store config in a ref to avoid re-render loops
  const configRef = React.useRef<StudioPageHeaderConfig | null>(null);
  
  // Version counter to trigger re-renders of consumers when config updates
  const [version, setVersion] = React.useState(0);
  
  // Stable setConfig function
  const setConfig = React.useCallback((config: StudioPageHeaderConfig | null) => {
    configRef.current = config;
    setVersion((v) => v + 1);
  }, []);

  const value = React.useMemo(
    () => ({ configRef, version, setConfig }),
    [version, setConfig]
  );

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
 * Hook to read the current page header config
 * Returns the config from the ref (always fresh)
 */
export function useStudioPageHeaderConfig(): StudioPageHeaderConfig | null {
  const { configRef, version } = useStudioPageHeaderContext();
  // version in deps ensures we re-render when config updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => configRef.current, [version]);
}

/**
 * Hook for studio pages to set their header configuration
 * 
 * The config object should be memoized with useMemo for best performance,
 * but the hook is designed to handle frequent updates without causing infinite loops.
 * 
 * @example
 * const handleAction = useCallback(() => { ... }, [deps]);
 * const headerConfig = useMemo(() => ({
 *   title: "Social Accounts",
 *   description: "Manage social accounts for this brand.",
 *   actions: <Button onClick={handleAction}>Connect Account</Button>
 * }), [handleAction]);
 * useStudioPageHeader(headerConfig);
 */
export function useStudioPageHeader(config: StudioPageHeaderConfig | null) {
  const { setConfig, configRef } = useStudioPageHeaderContext();
  
  // Combined effect: set config on mount/update, clear on unmount
  // This handles React Strict Mode correctly by always setting config on mount
  React.useEffect(() => {
    // Always set config on mount/update
    // Check current context value, not a local ref, to handle Strict Mode re-mounts
    if (configRef.current !== config) {
      setConfig(config);
    }
    
    // Clean up on unmount
    return () => {
      setConfig(null);
    };
  }, [config, setConfig, configRef]);
}

