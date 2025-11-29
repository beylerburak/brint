"use client";

/**
 * Brand Activity Panel
 * 
 * Displays activity events related to a specific brand.
 * Read-only view with pagination support.
 */

import { useState, useEffect, useCallback } from "react";
import { Clock, User, Bot, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { listBrandActivity } from "../api/brand-api";
import { logger } from "@/shared/utils/logger";

interface BrandActivityPanelProps {
  brandId: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  timestamp: string;
  actorType: string;
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export function BrandActivityPanel({ brandId }: BrandActivityPanelProps) {
  const { workspace, workspaceReady } = useWorkspace();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchActivity = useCallback(async (cursor?: string, append = false) => {
    if (!workspaceReady || !workspace?.id) {
      setLoading(false);
      return;
    }

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await listBrandActivity({
        workspaceId: workspace.id,
        brandId,
        cursor,
        limit: 20,
      });

      if (append) {
        setEvents((prev) => [...prev, ...(result.items || [])]);
      } else {
        setEvents(result.items || []);
      }
      setNextCursor(result.nextCursor);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch activity");
      setError(error);
      logger.error("Failed to fetch brand activity:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceReady, workspace?.id, brandId]);

  useEffect(() => {
    if (workspaceReady && workspace?.id) {
      fetchActivity();
    }
  }, [workspaceReady, workspace?.id, fetchActivity]);

  const loadMore = async () => {
    if (nextCursor && !loadingMore) {
      await fetchActivity(nextCursor, true);
    }
  };

  if (loading) {
    return <ActivitySkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchActivity()}
            className="mt-2"
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Clock className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            No activity yet. Events will appear here as you make changes to this brand.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {events.map((event) => (
          <ActivityItem key={event.id} event={event} />
        ))}
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Activity Item
// ============================================================================

interface ActivityItemProps {
  event: ActivityEvent;
}

function ActivityItem({ event }: ActivityItemProps) {
  // Use API-provided title/summary if available, fallback to computed display
  const computedDisplay = getEventDisplay(event);
  const title = event.title || computedDisplay.title;
  const description = event.summary || computedDisplay.description;
  const ActorIcon = getActorIcon(event.actorType);
  const relativeTime = formatRelativeTime(event.timestamp);
  const fullDate = formatFullDate(event.timestamp);

  return (
    <div className="flex gap-3 rounded-lg border p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <ActorIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground cursor-help w-fit">
                {relativeTime}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{fullDate}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getActorIcon(actorType: string) {
  switch (actorType) {
    case "user":
      return User;
    case "system":
      return Bot;
    case "integration":
      return Zap;
    default:
      return User;
  }
}

function getEventDisplay(event: ActivityEvent): { title: string; description?: string } {
  const eventTypeMap: Record<string, { title: string; description?: string }> = {
    "brand.created": { title: "Brand created" },
    "brand.updated": { title: "Brand updated", description: getChangesSummary(event.metadata) },
    "brand.deleted": { title: "Brand archived" },
    "brand.profile_completed": { title: "Profile completed" },
    "brand.social_account_connected": { title: "Social account connected" },
    "brand.social_account_disconnected": { title: "Social account disconnected" },
    "brand.publishing_defaults_updated": { title: "Publishing defaults updated" },
  };

  const display = eventTypeMap[event.type];
  if (display) {
    return display;
  }

  // Fallback for unknown event types
  return {
    title: event.type.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

function getChangesSummary(metadata?: Record<string, unknown>): string | undefined {
  if (!metadata?.changes) return undefined;

  const changes = metadata.changes as Record<string, { before?: unknown; after?: unknown }>;
  const changedFields = Object.keys(changes);

  if (changedFields.length === 0) return undefined;
  if (changedFields.length === 1) return `Changed ${changedFields[0]}`;
  if (changedFields.length === 2) return `Changed ${changedFields.join(" and ")}`;
  return `Changed ${changedFields.length} fields`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ============================================================================
// Skeleton
// ============================================================================

function ActivitySkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-lg border p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

