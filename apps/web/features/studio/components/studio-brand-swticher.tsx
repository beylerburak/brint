"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { ChevronDown, Plus, Building2 } from "lucide-react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrand } from "@/features/brand/context/brand-context";
import { useBrands } from "@/features/studio/hooks/use-brands";
import type { Brand } from "@/features/studio/api/brand-api";
import { Skeleton } from "@/components/ui/skeleton";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function BrandSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { brand: currentBrand, setBrand } = useBrand();
  const { brands, loading } = useBrands();

  // Find active brand from pathname or current brand context
  const activeBrand = React.useMemo(() => {
    if (currentBrand) {
      return brands.find((b) => b.slug === currentBrand.slug) || null;
    }
    
    // Try to extract brand from pathname
    const segments = pathname.split("/").filter(Boolean);
    const studioIndex = segments.findIndex((seg) => seg === "studio");
    if (studioIndex !== -1 && segments[studioIndex + 1]) {
      const brandSlug = segments[studioIndex + 1];
      return brands.find((b) => b.slug === brandSlug) || null;
    }
    
    return null;
  }, [brands, currentBrand, pathname]);

  const [selectedBrand, setSelectedBrand] = React.useState<Brand | null>(activeBrand || brands[0] || null);

  React.useEffect(() => {
    if (activeBrand) {
      setSelectedBrand(activeBrand);
    } else if (brands.length > 0 && !selectedBrand) {
      setSelectedBrand(brands[0]);
    }
  }, [activeBrand, brands, selectedBrand]);

  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    setBrand({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
    });
    
    // Navigate to brand dashboard
    const newPath = `/${locale}/${workspace?.slug}/studio/${brand.slug}/dashboard`;
    router.push(newPath);
  };

  if (loading || brands.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="w-fit px-1.5" disabled>
            <Skeleton className="size-5 rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-4 rounded" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!selectedBrand) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-fit px-1.5">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-5 items-center justify-center rounded-md">
                <Building2 className="size-3" />
              </div>
              <span className="truncate font-medium">{selectedBrand.name}</span>
              <ChevronDown className="opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Brands
            </DropdownMenuLabel>
            {brands.map((brand, index) => (
              <DropdownMenuItem
                key={brand.id}
                onClick={() => handleBrandSelect(brand)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-xs border">
                  <Building2 className="size-4 shrink-0" />
                </div>
                {brand.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add brand</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
