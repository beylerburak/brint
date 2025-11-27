"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

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
  const [brand, setBrandState] = useState<Brand | null>(null);
  const pathname = usePathname();

  // Initialize from route params or pathname
  useEffect(() => {
    // First try to use params.brand if provided (from nested routes)
    if (params.brand) {
      setBrandState({
        id: params.brand,
        slug: params.brand,
      });
      return;
    }

    // Otherwise, extract from pathname
    // Pathname format: /[locale]/[workspace]/studio/[brand]/... or /[locale]/[workspace]/studio
    if (pathname) {
      const segments = pathname.split("/").filter(Boolean);
      // segments[0] = locale, segments[1] = workspace, segments[2] = studio
      // segments[3] = brand (if exists in nested route)
      if (segments.length >= 4 && segments[2] === "studio") {
        const brandSlug = segments[3];
        setBrandState({
          id: brandSlug,
          slug: brandSlug,
        });
        return;
      }
    }

    // No brand found
    setBrandState(null);
  }, [params.brand, pathname]);

  const setBrand = (b: Brand | null) => {
    setBrandState(b);
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
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}

