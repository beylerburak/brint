export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 border-b">
        <p className="text-sm text-muted-foreground">
          Workspace: <span className="font-semibold">{workspace}</span>
        </p>
      </div>
      {children}
    </div>
  );
}

