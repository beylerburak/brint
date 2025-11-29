import { redirect } from "next/navigation";
import { getWorkspaceDashboardData } from "@/shared/api/server/space";

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
  }>;
}

/**
 * Workspace root route - redirects to dashboard
 * 
 * SSR redirect: If workspace exists, redirect to dashboard.
 * If workspace doesn't exist or user not authenticated, redirect to not-found.
 */
export default async function WorkspacePage({ params }: PageProps) {
  const { locale, workspace: workspaceSlug } = await params;

  // Check if workspace exists and user has access
  const data = await getWorkspaceDashboardData({
    workspaceSlug,
  });

  if (!data) {
    redirect("/not-found");
  }

  // Redirect to dashboard
  redirect(`/${locale}/${workspaceSlug}/dashboard`);
}

