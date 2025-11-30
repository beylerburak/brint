"use client";

/**
 * Studio Brand Index Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]
 * 
 * Redirects to /home automatically.
 */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { buildWorkspaceRoute } from "@/features/space/constants";

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
    brand: string;
  }>;
}

export default function StudioBrandIndexPage({ params }: PageProps) {
  const { brand: brandSlug, workspace: workspaceSlug } = use(params);
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    const homePath = buildWorkspaceRoute(
      locale,
      workspaceSlug,
      `studio/${brandSlug}/home`
    );
    router.replace(homePath);
  }, [locale, workspaceSlug, brandSlug, router]);

  // Return null while redirecting
  return null;
}
