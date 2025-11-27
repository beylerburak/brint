export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Studio shell layout - no BrandProvider here
  // BrandProvider is in /studio/[brand]/layout.tsx
  return <>{children}</>;
}
