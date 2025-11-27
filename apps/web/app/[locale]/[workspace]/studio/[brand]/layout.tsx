import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BrandProvider } from "@/features/brand/context/brand-context";
import { StudioSidebar, StudioHeader } from "@/features/studio";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand, workspace, locale } = await params;

  return (
    <BrandProvider params={{ brand, workspace, locale }}>
      <SidebarProvider>
        <StudioSidebar />
        <SidebarInset>
          <StudioHeader />
          <div className="flex flex-1 flex-col">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BrandProvider>
  );
}

