"use client";

import { useMemo } from "react";
import { usePageHeader } from "@/features/space/context/page-header-context";
import type { WorkspaceDashboardData } from "@/shared/api/server/space";

interface DashboardPageProps {
  initialData: WorkspaceDashboardData;
}

export function WorkspaceDashboardPage({ initialData }: DashboardPageProps) {
  const { workspace, user } = initialData;

  const headerConfig = useMemo(() => ({
    title: workspace.name || workspace.slug,
    description: `Welcome, ${user.name || user.email}`,
  }), [workspace.name, workspace.slug, user.name, user.email]);

  usePageHeader(headerConfig);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
        {workspace.isOwner && (
          <p className="text-sm text-muted-foreground">You are the owner</p>
        )}
      {/* Dashboard content will go here */}
    </div>
  );
}
