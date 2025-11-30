"use client";

/**
 * Studio Brand Context
 * 
 * Provides the current brand data throughout the Studio layout.
 * This context is set in the Studio layout and consumed by child components.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { BrandDetail } from "@/features/brand/types";

interface StudioBrandContextValue {
  brand: BrandDetail;
  refreshBrand: () => Promise<void>;
}

const StudioBrandContext = createContext<StudioBrandContextValue | undefined>(
  undefined
);

interface StudioBrandProviderProps {
  children: ReactNode;
  brand: BrandDetail;
  refreshBrand: () => Promise<void>;
}

export function StudioBrandProvider({
  children,
  brand,
  refreshBrand,
}: StudioBrandProviderProps) {
  return (
    <StudioBrandContext.Provider value={{ brand, refreshBrand }}>
      {children}
    </StudioBrandContext.Provider>
  );
}

export function useStudioBrandContext() {
  const context = useContext(StudioBrandContext);
  if (context === undefined) {
    throw new Error(
      "useStudioBrandContext must be used within a StudioBrandProvider"
    );
  }
  return context;
}

