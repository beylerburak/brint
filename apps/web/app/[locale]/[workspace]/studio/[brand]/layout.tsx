import { BrandProvider } from "@/features/brand/context/brand-context";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brand: string; workspace: string; locale: string }>;
}) {
  const { brand, workspace, locale } = await params;

  return (
    <BrandProvider params={{ brand, workspace, locale }}>
      {children}
    </BrandProvider>
  );
}

