import { WorkspaceDashboardPage } from "@/features/workspace/pages/dashboard-page";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return <WorkspaceDashboardPage workspace={workspace} />;
}

