"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PermissionGate, PERMISSIONS } from "@/permissions";
import { AvatarUploadDemo } from "@/app/[locale]/[workspace]/dashboard/avatar-upload-demo"; // TODO: Move to features/workspace/components when refactoring

interface DashboardPageProps {
  workspace: string;
}

export function WorkspaceDashboardPage({ workspace }: DashboardPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Workspace slug: <span className="font-semibold">{workspace}</span>
        </p>
      </div>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <div className="p-6">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-semibold">Welcome</h2>
              <p className="text-muted-foreground mt-1">
                This is your dashboard workspace.
              </p>
            </div>
            <Button>Sample Button</Button>
            <PermissionGate permission={PERMISSIONS.WORKSPACE_MEMBERS_MANAGE}>
              <AvatarUploadDemo workspaceSlug={workspace} />
            </PermissionGate>
            <DataTable data={[]} />
          </div>
        </div>
      </div>
    </div>
  );
}
