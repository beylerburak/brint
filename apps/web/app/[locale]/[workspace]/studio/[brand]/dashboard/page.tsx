import { BrandDashboardPage } from "@/features/workspace/pages/brand-dashboard-page";

export default async function BrandDashboardRoute({
  params,
}: {
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand } = await params;
  return <BrandDashboardPage brand={brand} />;
}
