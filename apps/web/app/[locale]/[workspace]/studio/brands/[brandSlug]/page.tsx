"use client";

import { use } from "react";
import { BrandDetailPage } from "@/features/brand/components/brand-detail-page";

/**
 * Brand Detail Page
 * 
 * Route: /[locale]/[workspace]/studio/brands/[brandSlug]
 * 
 * Displays detailed information about a brand with tabs for:
 * - Overview (profile info)
 * - Hashtag Presets
 * - Activity
 */

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
    brandSlug: string;
  }>;
}

export default function BrandPage({ params }: PageProps) {
  const { brandSlug } = use(params);
  return <BrandDetailPage brandSlug={brandSlug} />;
}

