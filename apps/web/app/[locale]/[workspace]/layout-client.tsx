"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/workspace/components/sidebar/app-sidebar";
import { WorkspaceHeader } from "@/features/workspace/components/workspace-header";

export function WorkspaceLayoutClient({
  children,
  workspace,
}: {
  children: React.ReactNode;
  workspace: string;
}) {
  const pathname = usePathname();
  
  // Don't show workspace sidebar in studio routes (both /studio and /studio/[brand])
  const isStudioRoute = pathname?.includes("/studio");

  if (isStudioRoute) {
    // In studio routes, only render children (studio sidebar will be in studio layout)
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <WorkspaceHeader workspace={workspace} />
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

