import { BrandSocialAccountsPage } from "@/features/workspace/pages/brand-social-accounts-page";

export default async function BrandSocialAccountsRoute({
  params,
}: {
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand } = await params;
  return <BrandSocialAccountsPage brand={brand} />;
}

