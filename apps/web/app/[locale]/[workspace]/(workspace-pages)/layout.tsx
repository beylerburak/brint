import { AppSidebar } from "@/features/workspace/workspace-sidebar"
import { SiteHeader } from "@/features/workspace/workspace-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { WorkspaceProvider } from "@/contexts/workspace-context"
import { WorkspaceGuard } from "@/components/workspace-guard"
import { SettingsModalProvider } from "@/features/settings/settings-modal-provider"
import { UserSettingsSync } from "@/components/user-settings-sync"

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return (
    <WorkspaceProvider>
      <WorkspaceGuard>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col">
                <div className="w-full px-4 py-4 md:px-6 md:py-6">
                  {children}
                </div>
              </div>
            </div>
          </SidebarInset>
          <UserSettingsSync />
          <SettingsModalProvider />
        </SidebarProvider>
      </WorkspaceGuard>
    </WorkspaceProvider>
  );
}

