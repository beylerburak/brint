"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/features/auth/components/language-switcher";
import { useBrand } from "@/features/brand/context/brand-context";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrands } from "@/features/studio/hooks/use-brands";

function getStudioPageTitle(pathname: string, brand: string | null): string {
  // Extract locale from pathname (first segment)
  const segments = pathname.split("/").filter(Boolean);
  
  // Find studio segment and get what comes after
  const studioIndex = segments.findIndex((seg) => seg === "studio");
  if (studioIndex === -1) {
    return brand ? brand : "Brand Studio";
  }
  
  // Get segments after studio
  const studioSegments = segments.slice(studioIndex + 1);
  
  // If no segments after studio, return Brand Studio
  if (studioSegments.length === 0) {
    return "Brand Studio";
  }
  
  // If only brand slug, return brand name or slug
  if (studioSegments.length === 1) {
    return brand || studioSegments[0];
  }
  
  // Get the last segment as page title (after brand slug)
  const lastSegment = studioSegments[studioSegments.length - 1];
  
  // Format label - capitalize first letter of each word
  return lastSegment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StudioHeader() {
  const pathname = usePathname();
  const { brand } = useBrand();
  const { brands, loading } = useBrands();
  const pageTitle = getStudioPageTitle(pathname, brand?.name || null);

  // Hide header when no brands (empty state)
  // Check if we're at /[locale]/[workspace]/studio (exactly, no brand segment)
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const studioIndex = pathSegments.findIndex((seg) => seg === "studio");
  const isStudioRoot = studioIndex !== -1 && pathSegments.length === studioIndex + 1;
  const shouldHideHeader = isStudioRoot && !loading && brands.length === 0;

  if (shouldHideHeader) {
    return null;
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base text-foreground font-medium">{pageTitle}</h1>
      </div>
      <div className="ml-auto flex items-center gap-2 px-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}

