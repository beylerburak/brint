"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar, Clock, CheckCircle, XCircle, Loader, FileText, Ban, ExternalLink, Edit, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import type { SocialPlatform } from "@/features/social-account";
import { CalendarEvent } from "./index";
import { formatDate, formatTime } from "@/shared/lib/date-time-format";
import { apiCache } from "@/shared/api/cache";
import type { UserProfile } from "@/features/space/api/user-api";

interface EventModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export function EventModal({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EventModalProps) {
  if (!event) return null;

  const duration = React.useMemo(() => {
    const diff = event.end.getTime() - event.start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) {
      return `${minutes} dakika`;
    } else if (minutes === 0) {
      return `${hours} saat`;
    } else {
      return `${hours}s ${minutes}d`;
    }
  }, [event.start, event.end]);

  const isMultiDay = React.useMemo(() => {
    return event.start.toDateString() !== event.end.toDateString();
  }, [event.start, event.end]);

  // Get status info
  const getStatusInfo = () => {
    switch (event.status) {
      case "published":
        return { label: "Yayınlandı", icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-500/10" };
      case "scheduled":
        return { label: "Planlandı", icon: Clock, color: "text-blue-500", bgColor: "bg-blue-500/10" };
      case "failed":
        return { label: "Başarısız", icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/10" };
      case "publishing":
        return { label: "Yayınlanıyor", icon: Loader, color: "text-yellow-500", bgColor: "bg-yellow-500/10" };
      case "draft":
        return { label: "Taslak", icon: FileText, color: "text-gray-500", bgColor: "bg-gray-500/10" };
      case "cancelled":
        return { label: "İptal edildi", icon: Ban, color: "text-orange-500", bgColor: "bg-orange-500/10" };
      default:
        return { label: "Bilinmiyor", icon: CheckCircle, color: "text-gray-500", bgColor: "bg-gray-500/10" };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Get platform display info
  const getPlatformName = () => {
    switch (event.platform) {
      case "instagram": return "Instagram";
      case "facebook": return "Facebook";
      case "x": return "X (Twitter)";
      case "tiktok": return "TikTok";
      case "youtube": return "YouTube";
      case "linkedin": return "LinkedIn";
      case "pinterest": return "Pinterest";
      default: return event.platform || "Bilinmiyor";
    }
  };

  const mapPlatformToSocialPlatform = (): SocialPlatform => {
    switch (event.platform) {
      case "instagram": return "INSTAGRAM_BUSINESS";
      case "facebook": return "FACEBOOK_PAGE";
      case "x": return "X_ACCOUNT";
      case "tiktok": return "TIKTOK_BUSINESS";
      case "youtube": return "YOUTUBE_CHANNEL";
      case "linkedin": return "LINKEDIN_PAGE";
      case "pinterest": return "PINTEREST_PROFILE";
      default: return "INSTAGRAM_BUSINESS";
    }
  };

  // Get user profile from cache for format preferences
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(() => 
    apiCache.get<UserProfile>("user:profile", 60000) || null
  );
  
  // Listen for user profile updates
  React.useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent<UserProfile>) => {
      setUserProfile(event.detail);
    };
    
    window.addEventListener("userProfileUpdated", handleProfileUpdate as EventListener);
    
    return () => {
      window.removeEventListener("userProfileUpdated", handleProfileUpdate as EventListener);
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="space-y-4 pb-4">
          {/* Platform Badge */}
          {event.platform && (
            <div className="flex items-center gap-2">
              <SocialPlatformIcon
                platform={mapPlatformToSocialPlatform()}
                size={24}
              />
              <span className="text-sm font-medium">{getPlatformName()}</span>
            </div>
          )}
          
          {/* Title */}
          <div>
            <SheetTitle className="text-xl font-semibold leading-relaxed">
              {event.title}
            </SheetTitle>
            {event.description && (
              <SheetDescription className="mt-2 text-base">
                {event.description}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium">{statusInfo.label}</p>
              <p className="text-xs text-muted-foreground">Yayın durumu</p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isMultiDay ? (
                  <>
                    {formatDate(event.start, userProfile?.dateFormat)}
                    <span className="text-muted-foreground mx-2">→</span>
                    {formatDate(event.end, userProfile?.dateFormat)}
                  </>
                ) : (
                  <>
                    {formatDate(event.start, userProfile?.dateFormat)}
                    <span className="text-muted-foreground">, {format(event.start, "EEEE")}</span>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(event.start, userProfile?.timeFormat)} - {formatTime(event.end, userProfile?.timeFormat)}
                <span className="text-muted-foreground/70">({duration})</span>
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-1">Süre</p>
              <p className="text-sm font-medium">{duration}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-1">Platform</p>
              <p className="text-sm font-medium">{getPlatformName()}</p>
            </div>
          </div>

          {/* Event ID */}
          <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 font-mono">
            ID: {event.id}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-6 mt-6 border-t">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onEdit(event);
                onOpenChange(false);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Düzenle
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => {
                onDelete(event);
                onOpenChange(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Sil
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
