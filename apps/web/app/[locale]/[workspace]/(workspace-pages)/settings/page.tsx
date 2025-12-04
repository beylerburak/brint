import { redirect } from "next/navigation"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspace: string; locale: string }>
}) {
  const { workspace, locale } = await params
  
  // Redirect to general settings by default
  redirect(`/${locale}/${workspace}/settings/general`)
}

