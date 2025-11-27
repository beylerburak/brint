"use client";

interface BrandSocialAccountsPageProps {
  brand: string;
}

export function BrandSocialAccountsPage({ brand }: BrandSocialAccountsPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Social Accounts</h1>
        <p className="text-muted-foreground">
          Manage social accounts connected to this brand
        </p>
      </div>
      {/* Social accounts management will be implemented here */}
    </div>
  );
}

