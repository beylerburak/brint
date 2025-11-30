"use client";

/**
 * Studio Brand Layout
 * 
 * Layout shell for the Brand Studio experience.
 * This layout wraps all studio/{brandSlug}/* routes.
 * 
 * Features:
 * - Studio-specific sidebar with brand switcher
 * - Draft guard: redirects to onboarding if brand is DRAFT
 * - Provides brand context to all child components
 */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useBrandBySlug } from "@/features/brand/hooks";
import { buildWorkspaceRoute } from "@/features/space/constants";
import { StudioLayoutClient } from "@/features/studio/components/studio-layout-client";
import { Skeleton } from "@/components/ui/skeleton";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
    workspace: string;
    brand: string;
  }>;
}

export default function StudioBrandLayout({ children, params }: LayoutProps) {
  const { brand: brandSlug, workspace: workspaceSlug } = use(params);
  const locale = useLocale();
  const router = useRouter();
  const { workspace, workspaceReady } = useWorkspace();
  const { brand, loading, error, refresh } = useBrandBySlug(brandSlug);

  // Draft guard: redirect to setup wizard if brand is DRAFT and onboarding not completed
  useEffect(() => {
    if (!loading && brand && workspace?.slug) {
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

  // Handle not found
  useEffect(() => {
    if (!loading && !brand && error) {
      const brandsPath = buildWorkspaceRoute(locale, workspaceSlug, "brands");
      router.replace(brandsPath);
    }
  }, [brand, loading, error, locale, workspaceSlug, router]);

  // Show loading state while fetching brand
  if (loading || !workspaceReady || !brand) {
    return <StudioLayoutSkeleton />;
  }

  // Don't render if brand is DRAFT (redirect will happen)
  if (brand.status === "DRAFT" && !brand.onboardingCompleted) {
    return <StudioLayoutSkeleton />;
  }

  return (
    <StudioLayoutClient
      workspaceSlug={workspaceSlug}
      brand={brand}
      refreshBrand={refresh}
    >
      {children}
    </StudioLayoutClient>
  );
}

function StudioLayoutSkeleton() {
  return (
    <div className="flex h-screen w-full">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r bg-sidebar p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2 mt-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-96 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
    </div>
  );
}

