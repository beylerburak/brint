import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { StudioSidebar, StudioHeader } from "@/features/studio";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Studio shell layout - no BrandProvider here
  // BrandProvider is in /studio/[brand]/layout.tsx
  // But we show studio sidebar here for /studio route
  return (
    <SidebarProvider>
      <StudioSidebar />
      <SidebarInset>
        <StudioHeader />
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
