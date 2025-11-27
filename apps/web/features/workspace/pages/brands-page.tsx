"use client";

interface BrandsPageProps {
  workspace: string;
}

export function BrandsPage({ workspace }: BrandsPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Brands</h1>
        <p className="text-muted-foreground">
          Manage your workspace brands
        </p>
      </div>
      {/* Brands list will be implemented here */}
    </div>
  );
}

