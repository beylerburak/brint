import { WorkspaceSettingsPage } from "@/features/workspace/pages/settings-page";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return <WorkspaceSettingsPage workspace={workspace} />;
}
