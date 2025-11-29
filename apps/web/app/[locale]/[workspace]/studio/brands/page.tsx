import { BrandStudioPage } from "@/features/brand/components/brand-studio-page";

/**
 * Brand Studio List Page
 * 
 * Route: /[locale]/[workspace]/studio/brands
 * 
 * Displays all brands for the current workspace with:
 * - Brand list with readiness indicators
 * - Create new brand wizard
 * - Quick actions (edit, archive)
 */
export default function BrandsPage() {
  return <BrandStudioPage />;
}

