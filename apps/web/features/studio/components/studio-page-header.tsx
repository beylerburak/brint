"use client";

/**
 * Studio Page Header
 * 
 * Header component for Studio pages with breadcrumbs and actions.
 */

import { SidebarTrigger } from "@/components/animate-ui/components/radix/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { BrandDetail } from "@/features/brand/types";

interface StudioPageHeaderProps {
  brand: BrandDetail;
  pageTitle?: string;
}

export function StudioPageHeader({ brand, pageTitle }: StudioPageHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href="#">{brand.name}</BreadcrumbLink>
          </BreadcrumbItem>
          {pageTitle && (
            <>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

