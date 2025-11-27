export default async function BrandDashboardPage({
  params,
}: {
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand } = await params;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Brand Dashboard</h1>
        <p className="text-muted-foreground">
          Brand slug: <span className="font-semibold">{brand}</span>
        </p>
      </div>
    </div>
  );
}

