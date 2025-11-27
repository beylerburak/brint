import { MembersPage } from "@/features/workspace/pages/members-page";

export default async function MembersRoute({
  params,
}: {
  params: Promise<{ workspace: string; locale: string }>;
}) {
  const { workspace } = await params;
  return <MembersPage workspace={workspace} />;
}

