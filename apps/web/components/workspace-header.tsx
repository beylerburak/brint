"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

function getPageTitle(pathname: string, workspace: string): string {
  // Extract locale from pathname (first segment)
  const segments = pathname.split("/").filter(Boolean);
  
  // Remove locale and workspace from segments
  const workspaceSegments = segments.slice(2); // Skip locale and workspace
  
  // If no segments, return Dashboard
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

interface WorkspaceHeaderProps {
  workspace: string;
}

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname, workspace);

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
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}

