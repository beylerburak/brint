/**
 * Brand Root Page
 * 
 * Redirects to /home by default
 */

import { redirect } from "next/navigation";
import { withLocale } from "@/lib/locale-path";

export default async function BrandRootPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string; brandSlug: string }>;
}) {
  const { locale, workspace, brandSlug } = await params;
  redirect(withLocale(locale, `/${workspace}/${brandSlug}/home`));
}

