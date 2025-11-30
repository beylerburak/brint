"use client";

/**
 * Brand Studio Detail Page
 * 
 * Main studio page for an active brand.
 * Includes draft guard: redirects to setup wizard if brand is DRAFT.
 */

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { buildWorkspaceRoute } from "@/features/space/constants";
import { useBrandBySlug } from "../hooks";
import { BrandDetailPage } from "./brand-detail-page";

interface BrandStudioDetailPageProps {
  brandSlug: string;
}

export function BrandStudioDetailPage({ brandSlug }: BrandStudioDetailPageProps) {
  const locale = useLocale();
  const router = useRouter();
  const { workspace } = useWorkspace();
  
  const { brand, loading } = useBrandBySlug(brandSlug);

  // Draft guard: redirect to setup wizard if brand is DRAFT
  useEffect(() => {
    if (!loading && brand && workspace?.slug) {
      // If brand is DRAFT and onboarding not completed, redirect to wizard
      if (brand.status === "DRAFT" && !brand.onboardingCompleted) {
        const setupPath = buildWorkspaceRoute(
          locale,
          workspace.slug,
          `brands/${brand.id}/setup`
        );
        router.replace(setupPath);
      }
    }
  }, [brand, loading, locale, workspace?.slug, router]);

  // While checking, show the detail page (it has its own loading state)
  return <BrandDetailPage brandSlug={brandSlug} />;
}

