export default async function BrandDashboardPage({
  params,
}: {
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand } = await params;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Brand Dashboard</h1>
      <p>Brand slug: {brand}</p>
    </div>
  );
}

