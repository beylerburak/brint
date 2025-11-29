"use client";

import type { WorkspaceDashboardData } from "@/shared/api/server/space";

interface DashboardPageProps {
  initialData: WorkspaceDashboardData;
}

export function WorkspaceDashboardPage({ initialData }: DashboardPageProps) {
  const { workspace, user } = initialData;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {workspace.name || workspace.slug}
        </h1>
        <p className="text-muted-foreground">
          Welcome, {user.name || user.email}
        </p>
        {workspace.isOwner && (
          <p className="text-sm text-muted-foreground">You are the owner</p>
        )}
      </div>
    </div>
  );
}
