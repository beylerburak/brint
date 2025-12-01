"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/shared/utils/index";
import { CheckCircle, Clock, XCircle, Loader, FileText, Ban } from "lucide-react";
import { CalendarEvent } from "./index";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";

interface EventCardProps {
  event: CalendarEvent;
  onClick?: () => void;
  showTime?: boolean;
  compact?: boolean;
}

export function EventCard({
  event,
  onClick,
  showTime = true,
  compact = false,
}: EventCardProps) {
  const iconSize = compact ? 16 : 16;
  const platformIconSize = compact ? 20 : 22;

  const StatusIcon = () => {
    const iconProps = { size: iconSize, className: "flex-shrink-0" };

    switch (event.status) {
      case "published":
        return <CheckCircle {...iconProps} className="text-green-500 flex-shrink-0" />;
      case "scheduled":
        return <Clock {...iconProps} className="text-blue-500 flex-shrink-0" />;
      case "failed":
        return <XCircle {...iconProps} className="text-red-500 flex-shrink-0" />;
      case "publishing":
        return <Loader {...iconProps} className="text-yellow-500 flex-shrink-0 animate-spin" />;
      case "draft":
        return <FileText {...iconProps} className="text-gray-500 flex-shrink-0" />;
      case "cancelled":
        return <Ban {...iconProps} className="text-orange-500 flex-shrink-0" />;
      default:
        return <CheckCircle {...iconProps} className="text-green-500 flex-shrink-0" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-muted hover:bg-muted/80 rounded-md cursor-pointer transition-all duration-200",
        // Desktop: full layout
        "hidden md:flex items-start gap-2",
        // Fixed width to prevent overflow outside cell
        "w-full max-w-full overflow-hidden",
        compact ? "p-1.5 text-xs" : "p-2 text-sm"
      )}
    >
      <StatusIcon />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 max-w-full">
          <div className={cn("font-medium truncate flex-1 min-w-0", compact && "text-xs")}>
            {event.title}
          </div>
          {event.platform && (
            <SocialPlatformIcon
              platform={event.platform === "instagram" ? "INSTAGRAM_BUSINESS" : event.platform === "facebook" ? "FACEBOOK_PAGE" : "X_ACCOUNT"}
              size={platformIconSize}
              className="opacity-80 flex-shrink-0"
            />
          )}
        </div>
        {showTime && (
          <div className={cn("text-muted-foreground truncate", compact ? "text-[10px]" : "text-xs")}>
            {format(new Date(event.start), "HH:mm")}
          </div>
        )}
      </div>
    </div>
  );
}

// Mobile-only event card component
export function MobileEventCard({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: () => void;
}) {
  const iconSize = 14;
  const platformIconSize = 20;

  const StatusIcon = () => {
    const iconProps = { size: iconSize, className: "flex-shrink-0" };

    switch (event.status) {
      case "published":
        return <CheckCircle {...iconProps} className="text-green-500 flex-shrink-0" />;
      case "scheduled":
        return <Clock {...iconProps} className="text-blue-500 flex-shrink-0" />;
      case "failed":
        return <XCircle {...iconProps} className="text-red-500 flex-shrink-0" />;
      case "publishing":
        return <Loader {...iconProps} className="text-yellow-500 flex-shrink-0 animate-spin" />;
      case "draft":
        return <FileText {...iconProps} className="text-gray-500 flex-shrink-0" />;
      case "cancelled":
        return <Ban {...iconProps} className="text-orange-500 flex-shrink-0" />;
      default:
        return <CheckCircle {...iconProps} className="text-green-500 flex-shrink-0" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-muted hover:bg-muted/80 rounded-md cursor-pointer transition-all duration-200",
        "md:hidden flex flex-col items-center justify-center gap-1 p-1.5"
      )}
    >
      <StatusIcon />
      {event.platform && (
        <SocialPlatformIcon
          platform={event.platform === "instagram" ? "INSTAGRAM_BUSINESS" : event.platform === "facebook" ? "FACEBOOK_PAGE" : "X_ACCOUNT"}
          size={platformIconSize}
          className="opacity-80 flex-shrink-0"
        />
      )}
    </div>
  );
}

