import type { ComponentProps, HTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusProps = ComponentProps<typeof Badge> & {
  status: "online" | "offline" | "maintenance" | "degraded";
};

export const Status = ({ className, status, ...props }: StatusProps) => (
  <Badge
    className={cn("flex items-center gap-2 min-w-0 max-w-full", "group", status, className)}
    variant="secondary"
    {...props}
  />
);

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement> & {
  color?: string; // Hex color from API (e.g., "#22c55e")
};

export const StatusIndicator = ({
  className,
  color,
  ...props
}: StatusIndicatorProps) => {
  // If color is provided, use it directly (from API)
  if (color) {
    return (
      <span className="relative flex h-2 w-2" {...props}>
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
    );
  }

  // Fallback to default colors for backwards compatibility
  return (
    <span className="relative flex h-2 w-2" {...props}>
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          "group-[.online]:bg-emerald-500",
          "group-[.offline]:bg-red-500",
          "group-[.maintenance]:bg-blue-500",
          "group-[.degraded]:bg-amber-500"
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          "group-[.online]:bg-emerald-500",
          "group-[.offline]:bg-red-500",
          "group-[.maintenance]:bg-blue-500",
          "group-[.degraded]:bg-amber-500"
        )}
      />
    </span>
  );
};

export type StatusLabelProps = HTMLAttributes<HTMLSpanElement>;

export const StatusLabel = ({
  className,
  children,
  ...props
}: StatusLabelProps) => (
  <span className={cn("text-muted-foreground truncate", className)} {...props}>
    {children ?? (
      <>
        <span className="hidden group-[.online]:block">Online</span>
        <span className="hidden group-[.offline]:block">Offline</span>
        <span className="hidden group-[.maintenance]:block">Maintenance</span>
        <span className="hidden group-[.degraded]:block">Degraded</span>
      </>
    )}
  </span>
);
