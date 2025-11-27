import { BrandProvider } from "@/features/brand/context/brand-context";

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; locale: string }>;
}) {
  const { workspace, locale } = await params;

  return (
    <BrandProvider params={{ workspace, locale }}>
      {children}
    </BrandProvider>
  );
}
