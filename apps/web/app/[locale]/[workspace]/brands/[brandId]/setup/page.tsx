"use client";

import { use } from "react";
import { BrandOnboardingWizardPage } from "@/features/brand/components/brand-onboarding-wizard-page";

/**
 * Brand Setup Page
 * 
 * Route: /[locale]/[workspace]/brands/[brandId]/setup
 * 
 * Multi-step wizard for setting up a new brand.
 * Only accessible for brands in DRAFT status with onboardingCompleted = false.
 */

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
    brandId: string;
  }>;
}

export default function BrandSetupPage({ params }: PageProps) {
  const { brandId } = use(params);
  return <BrandOnboardingWizardPage brandId={brandId} />;
}

