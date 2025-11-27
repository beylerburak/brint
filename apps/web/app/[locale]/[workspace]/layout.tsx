import { BrandProvider } from "@/features/brand/context/brand-context";
import { SubscriptionProvider } from "@/features/subscription";
import { WorkspaceLayoutClient } from "./layout-client";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { workspace, locale } = await params;

  return (
    <SubscriptionProvider>
      <BrandProvider params={{ workspace, locale }}>
        <WorkspaceLayoutClient workspace={workspace}>
          {children}
        </WorkspaceLayoutClient>
      </BrandProvider>
    </SubscriptionProvider>
  );
}
