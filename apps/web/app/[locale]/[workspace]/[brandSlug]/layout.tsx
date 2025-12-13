/**
 * Brand Layout
 * 
 * Independent layout for brand-specific pages.
 * Includes brand header with navigation menu.
 * 
 * Path: /[locale]/[workspace]/[brandSlug]/...
 */

import { BrandHeader } from "@/features/brand/brand-header"

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; brandSlug: string }>;
}) {
  const { workspace, brandSlug } = await params;

  return (
    <div className="min-h-screen flex flex-col">
      <BrandHeader />
      <main className="flex-1">
        <div className="w-full px-4 py-4 md:px-6 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

