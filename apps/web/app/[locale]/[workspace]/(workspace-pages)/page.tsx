import { redirect } from "next/navigation";
import { buildWorkspaceUrl } from "@/lib/locale-path";

export default async function WorkspaceRootPage({
  params,
}: {
  params: Promise<{ workspace: string; locale: string }>;
}) {
  const { workspace, locale } = await params;
  
  // Redirect to home
  redirect(buildWorkspaceUrl(locale, workspace, "/home"));
}
