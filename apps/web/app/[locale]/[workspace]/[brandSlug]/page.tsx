/**
 * Brand Root Page
 * 
 * Redirects to /home by default
 */

import { redirect } from "next/navigation";

export default async function BrandRootPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string; brandSlug: string }>;
}) {
  const { locale, workspace, brandSlug } = await params;
  redirect(`/${locale}/${workspace}/${brandSlug}/home`);
}

