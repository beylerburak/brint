import { WorkspaceDashboardPage } from "@/features/space/pages/dashboard-page";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return <WorkspaceDashboardPage workspace={workspace} />;
}
