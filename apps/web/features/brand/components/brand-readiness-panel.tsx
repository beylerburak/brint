"use client";

/**
 * Brand Readiness Panel
 * 
 * Displays brand readiness score and completion status badges.
 * Used in both brand list and brand detail pages.
 */

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, Globe, Hash } from "lucide-react";
import { cn } from "@/shared/utils";

export interface BrandReadinessData {
  readinessScore: number;
  profileCompleted: boolean;
  hasAtLeastOneSocialAccount: boolean;
  publishingDefaultsConfigured: boolean;
}

interface BrandReadinessPanelProps {
  data: BrandReadinessData;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Readiness panel showing score and status badges
 */
export function BrandReadinessPanel({
  data,
  variant = "compact",
  className,
}: BrandReadinessPanelProps) {
  const { readinessScore, profileCompleted, hasAtLeastOneSocialAccount, publishingDefaultsConfigured } = data;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "[&>div]:bg-green-500";
    if (score >= 40) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-red-500";
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className={cn("text-sm font-medium", getScoreColor(readinessScore))}>
          {readinessScore}%
        </span>
        <Progress
          value={readinessScore}
          className={cn("h-2 w-16", getProgressColor(readinessScore))}
        />
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Readiness Score
        </span>
        <span className={cn("text-lg font-bold", getScoreColor(readinessScore))}>
          {readinessScore}%
        </span>
      </div>

      <Progress
        value={readinessScore}
        className={cn("h-3", getProgressColor(readinessScore))}
      />

      <div className="flex flex-wrap gap-2 pt-2">
        <ReadinessBadge
          label="Profile"
          completed={profileCompleted}
          icon={<Check className="h-3 w-3" />}
        />
        <ReadinessBadge
          label="Social Accounts"
          completed={hasAtLeastOneSocialAccount}
          icon={<Globe className="h-3 w-3" />}
        />
        <ReadinessBadge
          label="Publishing"
          completed={publishingDefaultsConfigured}
          icon={<Hash className="h-3 w-3" />}
        />
      </div>
    </div>
  );
}

interface ReadinessBadgeProps {
  label: string;
  completed: boolean;
  icon: React.ReactNode;
}

function ReadinessBadge({ label, completed, icon }: ReadinessBadgeProps) {
  return (
    <Badge
      variant={completed ? "default" : "secondary"}
      className={cn(
        "flex items-center gap-1 text-xs",
        completed
          ? "bg-green-100 text-green-800 hover:bg-green-100"
          : "bg-muted text-muted-foreground"
      )}
    >
      {completed ? icon : <AlertCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

