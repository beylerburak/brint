/**
 * Root Workspace Layout
 * 
 * Minimal wrapper - just provides WorkspaceProvider context
 * Actual layout (sidebar/header) is in (workspace-pages)/layout.tsx
 */

import { WorkspaceProvider } from "@/contexts/workspace-context"
import { RouteTransition } from "@/components/route-transition"
import { PreferenceProvider } from "@/lib/preferences"

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
      <PreferenceProvider>
        <RouteTransition />
        {children}
      </PreferenceProvider>
    </WorkspaceProvider>
  );
}
