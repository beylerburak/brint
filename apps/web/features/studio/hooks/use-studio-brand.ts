"use client";

/**
 * Studio Brand Hook
 * 
 * Provides the current brand data from the Studio context.
 * This is a convenience wrapper around useStudioBrandContext.
 */

import { useStudioBrandContext } from "../context/studio-brand-context";

export function useStudioBrand() {
  const { brand, refreshBrand } = useStudioBrandContext();
  return { brand, refreshBrand };
}

