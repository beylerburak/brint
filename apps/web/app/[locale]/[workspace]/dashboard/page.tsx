import { redirect } from "next/navigation";
import { getWorkspaceDashboardData } from "@/shared/api/server/space";
import { WorkspaceDashboardPage } from "@/features/space/pages/dashboard-page";

interface PageProps {
  params: Promise<{
    locale: string;
    workspace: string;
  }>;
}

export default async function DashboardPage({ params }: PageProps) {
  const { workspace: workspaceSlug } = await params;

  // Fetch workspace dashboard data server-side
  const data = await getWorkspaceDashboardData({
    workspaceSlug,
  });

  // If workspace not found or user not authenticated, redirect to not-found
  if (!data) {
    redirect("/not-found");
  }

  return <WorkspaceDashboardPage initialData={data} />;
}
