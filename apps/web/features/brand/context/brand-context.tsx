"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type Brand = {
  id: string;
  slug: string;
  name?: string;
};

interface BrandContextValue {
  brand: Brand | null;
  setBrand: (b: Brand | null) => void;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

export function BrandProvider({
  params,
  children,
}: {
  params: { brand?: string; workspace: string; locale: string };
  children: React.ReactNode;
}) {
  const derivedBrand = useMemo(() => {
    // Brand slug comes from route params: /:locale/:workspace/studio/:brand/*
    const brandSlug = params.brand ?? null;
    
    if (!brandSlug) {
      return null;
    }

    return {
      id: brandSlug,
      slug: brandSlug,
    };
  }, [params.brand]);
  const [brandOverride, setBrandOverride] = useState<Brand | null>(null);

  const brand = brandOverride ?? derivedBrand;

  const setBrand = (b: Brand | null) => {
    setBrandOverride(b);
  };

  const value: BrandContextValue = {
    brand,
    setBrand,
  };

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    console.warn("useBrand called outside BrandProvider - returning null brand");
    return {
      brand: null,
      setBrand: () => {},
    } satisfies BrandContextValue;
  }
  return context;
}
