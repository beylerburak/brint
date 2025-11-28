"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/features/auth/components/language-switcher";
import { useSubscription } from "@/features/subscription";
import { AlertTriangle } from "lucide-react";
import { locales } from "@/shared/i18n/locales";

function getPageTitle(pathname: string, workspace: string): string {
  const segments = pathname.split("/").filter(Boolean);
  
  // Determine if first segment is locale
  const firstSegment = segments[0];
  const firstIsLocale = (locales as readonly string[]).includes(firstSegment);
  
  // Calculate workspace index: 0 if no locale, 1 if locale exists
  const workspaceIndex = firstIsLocale ? 1 : 0;
  
  // Get segments after workspace
  const workspaceSegments = segments.slice(workspaceIndex + 1);
  
  // If no segments (workspace root), return Dashboard
  if (workspaceSegments.length === 0) {
    return "Dashboard";
  }
  
  // Get the last segment as page title
  const lastSegment = workspaceSegments[workspaceSegments.length - 1];
  
  // Format label - capitalize first letter of each word
  return lastSegment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface SpaceHeaderProps {
  workspace: string;
}

export function SpaceHeader({ workspace }: SpaceHeaderProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, workspace);
  const { subscription, plan } = useSubscription();
  const isActive = subscription?.status === "ACTIVE" || !subscription;
  const renewsLabel = subscription?.renewsAt
    ? new Date(subscription.renewsAt).toLocaleDateString()
    : null;
  const statusLabel = isActive
    ? plan
    : `${plan} (${subscription?.status ?? "Unknown"})`;

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
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            isActive ? "bg-muted/50 text-foreground" : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {!isActive && <AlertTriangle className="h-4 w-4" />}
          <span className="font-medium uppercase">{statusLabel}</span>
          {renewsLabel && (
            <span className="text-[11px] text-muted-foreground">
              {renewsLabel}
            </span>
          )}
        </div>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}

