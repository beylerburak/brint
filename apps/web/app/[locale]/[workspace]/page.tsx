import { redirect } from "next/navigation";

export default async function WorkspaceRootPage({
  params,
}: {
  params: Promise<{ workspace: string; locale: string }>;
}) {
  const { workspace, locale } = await params;
  
  // Redirect to home
  const redirectPath = locale ? `/${locale}/${workspace}/home` : `/${workspace}/home`;
  redirect(redirectPath);
}
