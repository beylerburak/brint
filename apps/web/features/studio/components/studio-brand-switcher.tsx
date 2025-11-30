"use client";

/**
 * Studio Brand Switcher
 * 
 * Dropdown component for switching between brands in the Studio.
 * Follows the same UI pattern as the Team Switcher component.
 */

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/animate-ui/components/radix/sidebar";
import { useBrandList } from "@/features/brand/hooks";
import { buildWorkspaceRoute } from "@/features/space/constants";
import type { BrandDetail, BrandSummary } from "@/features/brand/types";
import { Skeleton } from "@/components/ui/skeleton";

interface StudioBrandSwitcherProps {
  workspaceSlug: string;
  activeBrand: BrandDetail;
}

export function StudioBrandSwitcher({
  workspaceSlug,
  activeBrand,
}: StudioBrandSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { brands, loading } = useBrandList({ includeArchived: false });

  // Filter out draft brands that haven't completed onboarding
  const availableBrands = brands.filter(
    (brand) => brand.status !== "DRAFT" || brand.onboardingCompleted
  );

  const handleBrandSelect = (brand: BrandSummary) => {
    if (brand.slug !== activeBrand.slug) {
      const path = buildWorkspaceRoute(
        locale,
        workspaceSlug,
        `studio/${brand.slug}/home`
      );
      router.push(path);
    }
  };

  const handleNewBrand = () => {
    const path = buildWorkspaceRoute(locale, workspaceSlug, "brands");
    router.push(path);
  };

  // Get initials for brand avatar
  const getBrandInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get brand color or default
  const getBrandColor = (brand: BrandSummary | BrandDetail) => {
    return brand.primaryColor || "hsl(var(--sidebar-primary))";
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                className="flex aspect-square size-8 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: getBrandColor(activeBrand) }}
              >
                {activeBrand.logoUrl ? (
                  <img
                    src={activeBrand.logoUrl}
                    alt={activeBrand.name}
                    className="size-8 object-contain rounded-lg"
                  />
                ) : (
                  <span className="text-xs font-semibold">
                    {getBrandInitials(activeBrand.name)}
                  </span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeBrand.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Brand Studio
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Brands
            </DropdownMenuLabel>
            
            {loading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              availableBrands.map((brand, index) => (
                <DropdownMenuItem
                  key={brand.id}
                  onClick={() => handleBrandSelect(brand)}
                  className="gap-2 p-2"
                >
                  <div
                    className="flex size-6 gap-1 items-center justify-center rounded-sm text-white"
                    style={{ backgroundColor: getBrandColor(brand) }}
                  >
                    {brand.logoUrl ? (
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="size-5 rounded-sm object-contain"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold">
                        {getBrandInitials(brand.name)}
                      </span>
                    )}
                  </div>
                  <span className="truncate flex-1">{brand.name}</span>
                  {brand.slug === activeBrand.slug && (
                    <Check className="size-4 text-primary" />
                  )}
                  {/* {index < 9 && (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  )} */}
                </DropdownMenuItem>
              ))
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNewBrand} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">
                New brand
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

