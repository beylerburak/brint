"use client";

interface BrandContentPageProps {
  brand: string;
}

export function BrandContentPage({ brand }: BrandContentPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="text-muted-foreground">
          Manage content for this brand
        </p>
      </div>
      {/* Content management will be implemented here */}
    </div>
  );
}

