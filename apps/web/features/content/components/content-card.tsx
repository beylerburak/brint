"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import { PLATFORM_INFO } from "@/features/social-account/types";
import { Lightbox } from "@/components/ui/lightbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Calendar, Edit, Send, MoreVertical, Trash2, Copy, PlusCircle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/shared/utils";
import { formatDateTime } from "@/shared/lib/date-time-format";
import { apiCache } from "@/shared/api/cache";
import type { UserProfile } from "@/features/space/api/user-api";

export interface ContentCardProps {
  /** Social account information */
  socialAccount: {
    id: string;
    platform: string;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  /** Content type: story, post, carousel, reel, etc. */
  contentType: "story" | "post" | "carousel" | "reel" | string;
  /** Caption text */
  caption: string;
  /** Array of image URLs (deprecated - use thumbnails + fullImages) */
  images?: string[];
  /** Array of thumbnail URLs for card preview */
  thumbnails?: string[];
  /** Array of full-size image URLs for lightbox */
  fullImages?: string[];
  /** Scheduled date for content */
  scheduledDate?: Date | string | null;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional handlers for actions */
  onEdit?: () => void;
  onPublish?: () => void;
  onAddToQueue?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  /** Optional className */
  className?: string;
}

export function ContentCard({
  socialAccount,
  contentType,
  caption,
  images = [],
  thumbnails,
  fullImages,
  scheduledDate,
  onClick,
  onEdit,
  onPublish,
  onAddToQueue,
  onDelete,
  onDuplicate,
  className,
}: ContentCardProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  // Use thumbnails for card preview, fallback to images
  const displayImages = thumbnails || images;
  // Use fullImages for lightbox, fallback to images
  const lightboxImages = fullImages || images;

  const platformKey = socialAccount.platform as keyof typeof PLATFORM_INFO;

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

  // Format scheduled date using user preferences
  const formattedDate = React.useMemo(() => {
    if (!scheduledDate) return null;
    try {
      const date = typeof scheduledDate === "string" ? new Date(scheduledDate) : scheduledDate;
      if (isNaN(date.getTime())) return null;
      // Use user's preferred date/time format with " at " separator
      return formatDateTime(date, userProfile?.dateFormat, userProfile?.timeFormat, " at ");
    } catch {
      return null;
    }
  }, [scheduledDate, userProfile?.dateFormat, userProfile?.timeFormat]);

  return (
    <>
      <div
        className={cn(
          "bg-card text-card-foreground border border-border/50 overflow-hidden rounded-lg",
          className
        )}
      >
        {/* Main Content */}
        <div
          className="flex h-[280px] cursor-pointer"
          onClick={onClick}
        >
          {/* Left side - 65% */}
          <div className="w-[65%] p-5 flex flex-col gap-4 border-r border-border/50">
            {/* 1. Social Account */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-11 w-11">
                  {socialAccount.avatarUrl && (
                    <AvatarImage src={socialAccount.avatarUrl} alt={socialAccount.displayName || ""} />
                  )}
                  <AvatarFallback className="text-sm">
                    {(socialAccount.displayName || socialAccount.username || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5">
                  <SocialPlatformIcon platform={platformKey} size={18} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {socialAccount.displayName || socialAccount.username || "Unknown Account"}
                </div>
                {socialAccount.username && (
                  <div className="text-xs text-muted-foreground truncate">@{socialAccount.username}</div>
                )}
              </div>
            </div>

            {/* 2. Content Type Badge */}
            <Badge variant="outline" className="w-fit h-6 text-xs">
              {contentType.charAt(0).toUpperCase() + contentType.slice(1)}
            </Badge>

            {/* 3. Caption */}
            <div className="flex-1 min-h-[3rem]">
              <p className="text-sm text-foreground leading-relaxed line-clamp-2">{caption}</p>
            </div>

            {/* 4. Scheduled Date */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formattedDate || "Not scheduled"}</span>
            </div>
          </div>

          {/* Right side - 35% */}
          <div className="w-[35%] p-3 bg-muted/30" onClick={(e) => e.stopPropagation()}>
            {displayImages.length > 0 ? (
              <div
                className={cn(
                  "grid gap-1.5 h-full",
                  displayImages.length === 1
                    ? "grid-cols-1"
                    : displayImages.length === 2
                    ? "grid-cols-1"
                    : "grid-cols-2"
                )}
              >
                {displayImages.slice(0, 4).map((imageUrl, displayIndex) => {
                  const actualIndex = displayIndex;
                  const isOverlayImage = displayImages.length > 4 && displayIndex === 3;
                  const shouldShow = displayIndex < 4;

                  if (!shouldShow) return null;

                  const handleClick = () => {
                    // If clicking on overlay image, open from the 4th image (index 3)
                    // Otherwise open from the clicked image index
                    setLightboxIndex(isOverlayImage ? 3 : actualIndex);
                  };

                  return (
                    <div
                      key={actualIndex}
                      className={cn(
                        "relative group cursor-pointer rounded-md overflow-hidden border border-border/50",
                        displayImages.length === 1
                          ? "h-full"
                          : displayImages.length === 2
                          ? "h-1/2"
                          : displayImages.length === 3 && displayIndex === 0
                          ? "row-span-2"
                          : "h-full"
                      )}
                      onClick={handleClick}
                    >
                      <img
                        src={imageUrl}
                        alt={`Content image ${actualIndex + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {isOverlayImage && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                          <span className="text-white font-semibold text-sm">
                            +{displayImages.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-md">
                No images
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div
          className="border-t border-border/50 flex items-center justify-between px-4 py-3 bg-muted/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {/* Add to Queue Button */}
            {onAddToQueue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToQueue();
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add to Queue
              </Button>
            )}

            {/* Publish Button */}
            {onPublish && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onPublish();
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Publish Now
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Button */}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}

            {/* More Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onDuplicate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate();
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {(onEdit || onPublish || onDuplicate) && onDelete && (
                  <DropdownMenuSeparator />
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          getImageAlt={(index) => `Content image ${index + 1}`}
        />
      )}
    </>
  );
}

