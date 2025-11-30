"use client";

import { use } from "react";
import { BrandStudioDetailPage } from "@/features/brand/components/brand-studio-detail-page";

/**
 * Studio Brand Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]
 * 
 * Displays the brand studio for an active brand.
 * Redirects to setup wizard if brand is DRAFT and not onboarded.
 */

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
    brand: string; // brandSlug
  }>;
}

export default function StudioBrandPage({ params }: PageProps) {
  const { brand } = use(params);
  return <BrandStudioDetailPage brandSlug={brand} />;
}

