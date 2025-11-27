import { BrandsPage } from "@/features/workspace/pages/brands-page";

export default async function BrandsRoute({
  params,
}: {
  params: Promise<{ workspace: string; locale: string }>;
}) {
  const { workspace } = await params;
  return <BrandsPage workspace={workspace} />;
}

