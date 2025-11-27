"use client";

interface BrandDashboardPageProps {
  brand: string;
}

export function BrandDashboardPage({ brand }: BrandDashboardPageProps) {
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
