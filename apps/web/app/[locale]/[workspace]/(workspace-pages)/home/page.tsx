"use client"

import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  const { currentWorkspace, isLoadingWorkspace, user } = useWorkspace();

  if (isLoadingWorkspace) {
    return (
      <div className="px-4 lg:px-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6">
      <h1 className="text-2xl font-bold">
        Welcome to {currentWorkspace?.name || 'Workspace'}
      </h1>
      {user && (
        <p className="text-muted-foreground mt-2">
          Hello, {user.name || user.email}! You are a <strong>{currentWorkspace?.userRole}</strong> in this workspace.
        </p>
      )}
      {currentWorkspace && (
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>Plan: <strong>{currentWorkspace.plan}</strong></p>
          <p>Timezone: <strong>{currentWorkspace.timezone}</strong></p>
          <p>Currency: <strong>{currentWorkspace.baseCurrency}</strong></p>
          {/* memberCount is only available after full workspace details are loaded */}
          {/* For now, we skip showing it to avoid unnecessary API call */}
          {/* If needed, it can be loaded lazily or shown when available */}
        </div>
      )}
    </div>
  );
}

