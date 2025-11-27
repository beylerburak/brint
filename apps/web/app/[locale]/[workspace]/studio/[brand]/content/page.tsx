import { BrandContentPage } from "@/features/workspace/pages/brand-content-page";

export default async function BrandContentRoute({
  params,
}: {
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand } = await params;
  return <BrandContentPage brand={brand} />;
}

