"use client";

import { Button } from "@/components/ui/button";

interface WorkspaceSettingsPageProps {
  workspace: string;
}

export function WorkspaceSettingsPage({ workspace }: WorkspaceSettingsPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-muted-foreground">
          Workspace slug: <span className="font-semibold">{workspace}</span>
        </p>
      </div>
      <Button>Sample Button</Button>
    </div>
  );
}
