import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/workspace/components/sidebar/app-sidebar";
import { WorkspaceHeader } from "@/features/workspace/components/workspace-header";
import { BrandProvider } from "@/features/brand/context/brand-context";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { workspace, locale } = await params;

  return (
    <BrandProvider params={{ workspace, locale }}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <WorkspaceHeader workspace={workspace} />
          <div className="flex flex-1 flex-col">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BrandProvider>
  );
}
