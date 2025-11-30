"use client";

/**
 * Studio Brand Social Accounts Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/social-accounts
 * 
 * Social account management page for the brand studio.
 */

import { useStudioBrand } from "@/features/studio/hooks";
import { StudioPageHeader } from "@/features/studio/components/studio-page-header";
import { BrandSocialAccountsPanel } from "@/features/brand/components/brand-social-accounts-panel";

export default function StudioBrandSocialAccountsPage() {
  const { brand, refreshBrand } = useStudioBrand();

  return (
    <div className="flex h-full flex-col">
      <StudioPageHeader brand={brand} pageTitle="Social Accounts" />
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Social Accounts</h1>
          <p className="mt-1 text-muted-foreground">
            Connect and manage social media accounts for {brand.name}
          </p>
        </div>

        {/* Social Accounts Panel - handles data fetching, display, and actions */}
        <BrandSocialAccountsPanel 
          brandId={brand.id} 
          onBrandRefresh={refreshBrand}
        />
      </div>
    </div>
  );
}
