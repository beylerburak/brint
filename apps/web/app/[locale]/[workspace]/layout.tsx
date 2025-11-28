import { notFound } from "next/navigation";
import { BrandProvider } from "@/features/brand/context/brand-context";
import { SubscriptionProvider } from "@/features/subscription";
import { WorkspaceLayoutClient } from "./layout-client";

const reservedRoutes = [
  "login",
  "signup",
  "sign-up",
  "debug-context",
  "config-debug",
  "http-debug",
  "onboarding",
  "invites",
  "auth",
  "not-found",
  "404",
];

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { workspace, locale } = await params;

  // If workspace slug is a reserved route, show not found
  if (reservedRoutes.includes(workspace)) {
    notFound();
  }

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
