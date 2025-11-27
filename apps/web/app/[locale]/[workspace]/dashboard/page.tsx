import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return (
    <div className="p-8">
      <div className="absolute top-8 right-8 flex gap-2">
        <LogoutButton />
        <ThemeToggle />
      </div>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Workspace slug: <span className="font-semibold">{workspace}</span>
        </p>
        <Button>Sample Button</Button>
      </div>
    </div>
  );
}

