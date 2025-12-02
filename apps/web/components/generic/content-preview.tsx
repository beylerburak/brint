"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import { cn } from "@/shared/utils";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Check, ChevronLeft, ChevronRight, X, Volume2, VolumeX } from "lucide-react";
import type { PlatformId } from "@/shared/content/content-type-matrix";
import type { SocialPlatform } from "@/features/social-account";

export interface ContentPreviewProps {
  /** Platform identifier */
  platform: PlatformId;
  /** Social account information */
  socialAccount: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    platform: SocialPlatform;
    isVerified?: boolean;
  };
  /** Content type */
  contentType: "single_post" | "carousel" | "vertical_video" | "story";
  /** Caption text */
  caption?: string;
  /** Media URLs (images or videos) */
  media?: Array<{
    url: string;
    type: "image" | "video";
  }>;
  /** Engagement metrics (optional, for preview realism) */
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
  };
  /** Timestamp (optional) */
  timestamp?: string | Date;
  /** Custom className */
  className?: string;
  /** Maximum width of the preview (deprecated - now responsive) */
  maxWidth?: number;
}

/**
 * ContentPreview Component
 * 
 * A generic component that renders platform-specific content previews.
 * Currently supports Instagram posts with exact Instagram UI styling.
 */
export function ContentPreview({
  platform,
  socialAccount,
  contentType,
  caption = "",
  media = [],
  engagement,
  timestamp,
  className,
  maxWidth, // Ignored - component is now fully responsive
}: ContentPreviewProps) {
  // Render platform-specific preview
  if (platform === "instagram") {
    // Story content type
    if (contentType === "story") {
      return (
      <InstagramStoryPreview
        socialAccount={socialAccount}
        media={media}
        timestamp={timestamp}
        className={className}
      />
      );
    }

    // Reel content type (vertical_video)
    if (contentType === "vertical_video") {
      return (
        <InstagramReelPreview
          socialAccount={socialAccount}
          caption={caption}
          media={media}
          engagement={engagement}
          timestamp={timestamp}
          className={className}
        />
      );
    }

    // Post content types (single_post, carousel)
    return (
      <InstagramPostPreview
        socialAccount={socialAccount}
        contentType={contentType}
        caption={caption}
        media={media}
        engagement={engagement}
        timestamp={timestamp}
        className={className}
      />
    );
  }

  // Fallback for unsupported platforms
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <p className="text-sm text-muted-foreground">
        Preview not available for {platform}
      </p>
    </div>
  );
}

/**
 * Instagram Story Preview
 * 
 * Renders an Instagram story preview with story UI elements
 */
interface InstagramStoryPreviewProps {
  socialAccount: ContentPreviewProps["socialAccount"];
  media: ContentPreviewProps["media"];
  timestamp?: ContentPreviewProps["timestamp"];
  className?: string;
}

function InstagramStoryPreview({
  socialAccount,
  media = [],
  timestamp,
  className,
}: InstagramStoryPreviewProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [progressValues, setProgressValues] = React.useState<number[]>(() => media.map((_, index) => index === 0 ? 0 : 0));
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(true);
  const animationFrameRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number>(Date.now());
  const progressRef = React.useRef<number[]>(media.map((_, index) => index === 0 ? 0 : 0));
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Preserve progress state when media array changes (drag drop reordering)
  React.useEffect(() => {
    const prevLength = progressRef.current.length;
    if (media.length !== prevLength) {
      console.log('Media length changed from', prevLength, 'to', media.length, '- resetting progress');
      progressRef.current = media.map((_, index) => index === 0 ? 0 : 0);
      setProgressValues([...progressRef.current]);
      setCurrentIndex(0);
      startTimeRef.current = Date.now();
    } else {
      // For drag drop reordering, we want to preserve progress state
      // since only the order changes, not the actual media content
      console.log('Media order changed - preserving progress state');
    }
  }, [media.length]);

  // Story duration - Instagram story'ler genellikle 5 saniye
  const STORY_DURATION = 5000; // 5 seconds

  const currentMedia = media[currentIndex] || null;

  // Update progressRef when media array changes
  React.useEffect(() => {
    progressRef.current = media.map((_, index) => index === 0 ? 0 : 0);
    setProgressValues([...progressRef.current]);
  }, [media.length]);

  // Progress bar animasyonunu çalıştır - sadece image'lar için
  React.useEffect(() => {
    // Video için animasyon kullanma, video kendi süresine göre ilerler
    if (!isPlaying || media.length === 0 || currentMedia?.type === "video") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let lastUpdateTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / STORY_DURATION, 1);

      // Update ref immediately
      progressRef.current = progressRef.current.map((val, index) =>
        index < currentIndex ? 1 : index === currentIndex ? progress : 0
      );

      // Only update state every 50ms to reduce re-renders (20fps instead of 60fps)
      if (currentTime - lastUpdateTime >= 50) {
        setProgressValues([...progressRef.current]);
        lastUpdateTime = currentTime;
      }

      // Story tamamlandıysa sonraki story'e geç
      if (progress >= 1) {
        if (currentIndex < media.length - 1) {
          // Sonraki story'e geç
          setCurrentIndex(prev => prev + 1);
          startTimeRef.current = Date.now();
          progressRef.current = progressRef.current.map((val, index) =>
            index <= currentIndex ? 1 : 0
          );
          setProgressValues([...progressRef.current]);
        } else {
          // Son story tamamlandı, başa dön
          setCurrentIndex(0);
          startTimeRef.current = Date.now();
          progressRef.current = media.map(() => 0);
          setProgressValues([...progressRef.current]);
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [currentIndex, isPlaying, media.length, currentMedia?.type]);

  // Story değiştiğinde animasyonu yeniden başlat
  React.useEffect(() => {
    startTimeRef.current = Date.now();

    // Update ref
    progressRef.current = progressRef.current.map((val, index) =>
      index < currentIndex ? 1 : index === currentIndex ? 0 : 0
    );

    // Update state
    setProgressValues([...progressRef.current]);
  }, [currentIndex, media.length]);

  // Format timestamp
  const formattedTimestamp = React.useMemo(() => {
    if (!timestamp) return "11h";
    try {
      const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return "11h";
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) return "now";
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return "7d+";
    } catch {
      return "11h";
    }
  }, [timestamp]);

  // Get account initials for fallback
  const getAccountInitials = (): string => {
    if (socialAccount.displayName) {
      return socialAccount.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (socialAccount.username) {
      return socialAccount.username.slice(0, 2).toUpperCase();
    }
    return "AC";
  };

  // Video handling - pause/play based on current story
  React.useEffect(() => {
    if (currentMedia?.type === "video" && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {
          // Video play failed, continue with timer
        });
      } else {
        videoRef.current.pause();
      }
      // Update muted state
      videoRef.current.muted = isMuted;
    }
  }, [currentMedia, isPlaying, isMuted]);

  // Toggle sound function
  const toggleSound = React.useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Video progress tracking
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || currentMedia?.type !== "video") return;

    const handleTimeUpdate = () => {
      const progress = video.currentTime / video.duration;

      // Update ref
      progressRef.current = progressRef.current.map((val, index) =>
        index < currentIndex ? 1 : index === currentIndex ? progress : 0
      );

      // Update state
      setProgressValues([...progressRef.current]);
    };

    const handleLoadedMetadata = () => {
      // Video loaded, start playing if it's the current story
      if (isPlaying) {
        video.play().catch(() => {
          // Video play failed, continue with timer fallback
        });
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [currentMedia, currentIndex, isPlaying]);

  return (
    <div
      className={cn(
        "bg-black relative rounded-lg overflow-hidden w-full",
        className
      )}
      style={{ 
        aspectRatio: "9 / 16",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Story media - Absolute positioned, full container */}
      <div className="absolute inset-0 bg-black overflow-hidden rounded-lg" style={{ bottom: "12.01%" }}>
        {currentMedia ? (
          currentMedia.type === "video" ? (
            <video
              ref={videoRef}
              src={currentMedia.url}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
              controls={false}
              playsInline
              loop={false}
              onEnded={() => {
                // Video bittiğinde sonraki story'e geç
                if (currentIndex < media.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                } else {
                  setCurrentIndex(0);
                }
              }}
            />
          ) : (
            <img
              src={currentMedia.url}
              alt="Instagram story"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
              onError={() => console.log('Story preview image failed to load:', currentMedia.url)}
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <p className="text-sm">No media</p>
          </div>
        )}

        {/* Navigation areas (tap left/right to navigate) */}
        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => {
                // Pause animation temporarily
                setIsPlaying(false);
                setTimeout(() => setIsPlaying(true), 100);
                // Go to previous story
                setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
              }}
              className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
              aria-label="Previous story"
            />
            <button
              type="button"
              onClick={() => {
                // Pause animation temporarily
                setIsPlaying(false);
                setTimeout(() => setIsPlaying(true), 100);
                // Go to next story
                setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
              aria-label="Next story"
            />
          </>
        )}
      </div>

      {/* Story progress bars and header - Top overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 flex flex-col pb-0 pt-0 px-0" style={{ bottom: "92.88%" }}>
        {/* Progress bars */}
        <div className="h-3 relative rounded-full shrink-0 w-full px-2 pt-2">
          <div className="flex gap-1 h-0.5">
            {media.length > 0 ? (
              media.map((_, index) => (
                <div
                  key={index}
                  className="flex-1 h-0.5 bg-white/35 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white rounded-full"
                    style={{
                      width: `${progressValues[index] * 100}%`,
                      transition: 'none' // Disable CSS transitions for smooth JavaScript animation
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="flex-1 h-0.5 bg-white/35 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '83.29%' }} />
              </div>
            )}
          </div>
        </div>

        {/* Story header */}
        <div className="h-[42px] relative shrink-0 w-full">
          <div className="flex flex-row items-center size-full">
            <div className="box-border flex gap-4 h-[42px] items-center pl-[6px] pr-2 py-0 relative w-full">
              {/* User Info */}
              <div className="basis-0 flex grow items-center min-h-px min-w-px relative shrink-0">
                {/* Story avatar */}
                <div className="relative shrink-0 size-[32px]">
                  <Avatar className="size-full border-[1.5px] border-white">
                    {socialAccount.avatarUrl ? (
                      <AvatarImage
                        src={socialAccount.avatarUrl}
                        alt={socialAccount.displayName || socialAccount.username || "Account"}
                      />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 text-white text-xs font-semibold">
                        {getAccountInitials()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>

                {/* Name */}
                <div className="flex flex-row items-center self-stretch">
                  <div className="box-border flex h-full items-center pb-[2px] pl-2 pr-0 pt-0 relative shrink-0">
                    <p className="font-semibold leading-normal text-[13px] text-nowrap text-white tracking-[0.13px] whitespace-pre">
                      {socialAccount.username || socialAccount.displayName || "username"}
                    </p>
                  </div>
                </div>

                {/* Verified badge */}
                {socialAccount.isVerified && (
                  <div className="relative shrink-0 size-4">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="8" fill="#0095F6" />
                      <path
                        d="M6.5 8l1 1 2-2"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                {/* Time */}
                <div className="flex flex-row items-center self-stretch">
                  <div className="box-border flex h-full items-center pb-[2px] pl-1 pr-0 pt-0 relative shrink-0">
                    <p className="leading-normal text-[13px] text-[rgba(255,255,255,0.7)] text-nowrap tracking-[0.26px] whitespace-pre">
                      {formattedTimestamp}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 items-start relative shrink-0">
                {currentMedia?.type === "video" && (
                  <button
                    type="button"
                    onClick={toggleSound}
                    className="text-white hover:opacity-70 transition-opacity relative shrink-0 size-6"
                    aria-label={isMuted ? "Unmute video" : "Mute video"}
                  >
                    {isMuted ? (
                      <VolumeX className="block size-full" />
                    ) : (
                      <Volume2 className="block size-full" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  className="text-white hover:opacity-70 transition-opacity relative shrink-0 size-6"
                  aria-label="More options"
                >
                  <MoreHorizontal className="block size-full" />
                </button>
                <button
                  type="button"
                  className="text-white hover:opacity-70 transition-opacity relative shrink-0 size-6"
                  aria-label="Close"
                >
                  <X className="block size-full" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Story footer - Toolbar */}
      <div className="absolute bg-black bottom-0 box-border flex flex-col gap-4 items-start left-0 pb-0 pt-4 px-0 right-0" style={{ top: "87.99%" }}>
        {/* Message bar */}
        <div className="box-border flex gap-3 items-center px-3 py-0 relative shrink-0 w-full">
          {/* Message input */}
          <div className="basis-0 grow h-[38px] min-h-px min-w-px relative rounded-full shrink-0">
            <div className="absolute border border-[rgba(255,255,255,0.35)] border-solid inset-0 pointer-events-none rounded-full" />
            <div className="flex flex-row items-center size-full">
              <div className="box-border flex h-[38px] items-center px-4 py-0 relative w-full">
                <p className="leading-normal text-[13px] text-center text-nowrap text-white tracking-[0.26px] whitespace-pre">
                  Send message
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 items-start relative shrink-0">
            <button
              type="button"
              className="text-white hover:opacity-70 transition-opacity relative shrink-0 size-6"
              aria-label="Like"
            >
              <Heart className="block size-full" />
            </button>
            <button
              type="button"
              className="text-white hover:opacity-70 transition-opacity relative shrink-0 size-6"
              aria-label="Share"
            >
              <Send className="block size-full" />
            </button>
          </div>
        </div>

        {/* Home indicator */}
        <div className="h-[21px] relative shrink-0 w-full">
          <div className="absolute bottom-2 flex h-[5px] items-center justify-center left-1/2 translate-x-[-50%] w-[139px]">
            <div className="bg-white h-[5px] rounded-full w-[139px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Instagram Post Preview
 * 
 * Renders an Instagram post preview that matches the exact Instagram UI.
 */
interface InstagramPostPreviewProps {
  socialAccount: ContentPreviewProps["socialAccount"];
  contentType: ContentPreviewProps["contentType"];
  caption: string;
  media: ContentPreviewProps["media"];
  engagement?: ContentPreviewProps["engagement"];
  timestamp?: ContentPreviewProps["timestamp"];
  className?: string;
}

/**
 * InstagramMediaCarousel Component
 * 
 * Renders Instagram media carousel with navigation arrows and dots
 */
function InstagramMediaCarousel({ 
  media, 
  caption 
}: { 
  media: Array<{ url: string; type: "image" | "video" }>; 
  caption?: string;
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  if (media.length === 0) {
    return (
      <div className="relative bg-black">
        <div
          className="w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center"
          style={{ aspectRatio: "4 / 5" }}
        >
          <div className="text-center text-gray-400 dark:text-gray-600">
            <p className="text-sm">No media</p>
          </div>
        </div>
      </div>
    );
  }

  const currentMedia = media[currentIndex];

  return (
    <div className="relative bg-black group">
      <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
        {currentMedia.type === "video" ? (
          <video
            src={currentMedia.url}
            className="w-full h-full object-contain"
            controls={false}
            muted
            playsInline
          />
        ) : (
          <img
            src={currentMedia.url}
            alt={caption || "Instagram post"}
            className="w-full h-full object-contain"
          />
        )}

        {/* Navigation arrows (show on hover if multiple media) */}
        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5 text-black dark:text-white" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5 text-black dark:text-white" />
            </button>
          </>
        )}

        {/* Carousel dots indicator (if multiple media) */}
        {media.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {media.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === currentIndex
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/50"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CaptionText Component
 * 
 * Renders caption text with highlighted hashtags and mentions (Instagram style)
 * Preserves line breaks from textarea (handled by whitespace-pre-wrap CSS)
 */
function CaptionText({ text }: { text: string }) {
  // Split text by hashtags and mentions, then render with highlights
  // Line breaks are preserved by whitespace-pre-wrap CSS on parent
  const parts = text.split(/(#[^\s]+|@[^\s]+)/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("#") || part.startsWith("@")) {
          return (
            <span
              key={index}
              className="text-[#00376B] dark:text-[#8E8E8E]"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

/**
 * CaptionWithMore Component
 * 
 * Renders caption with "more" toggle if text exceeds 2 lines
 */
function CaptionWithMore({ username, caption }: { username: string; caption?: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [needsMore, setNeedsMore] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fullTextRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (fullTextRef.current && caption) {
      // Measure the full text height
      const lineHeight = parseFloat(getComputedStyle(fullTextRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * 2;
      const fullHeight = fullTextRef.current.scrollHeight;
      
      setNeedsMore(fullHeight > maxHeight);
    }
  }, [caption]);

  if (!caption) {
    return (
      <div className="space-y-1">
        <div className="text-sm text-black dark:text-white break-words whitespace-pre-wrap">
          <span className="font-semibold">{username}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-sm text-black dark:text-white break-words" ref={containerRef}>
        {/* Hidden full text for measurement (including username) */}
        <div
          ref={fullTextRef}
          className="absolute opacity-0 pointer-events-none whitespace-pre-wrap text-sm"
          style={{
            visibility: "hidden",
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
            width: containerRef.current?.offsetWidth || "100%",
          }}
        >
          <span className="font-semibold">{username}</span>
          {" "}
          <CaptionText text={caption} />
        </div>
        {/* Visible caption text with username */}
        <span
          className="whitespace-pre-wrap"
          style={{
            display: isExpanded ? "inline" : "-webkit-box",
            WebkitLineClamp: isExpanded ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: isExpanded ? "visible" : "hidden",
          }}
        >
          <span className="font-semibold">{username}</span>
          {" "}
          <CaptionText text={caption} />
        </span>
        {needsMore && (
          <>
            {!isExpanded && "... "}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {isExpanded ? "less" : "more"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InstagramPostPreview({
  socialAccount,
  contentType,
  caption,
  media = [],
  engagement,
  timestamp,
  className,
}: InstagramPostPreviewProps) {
  // Format timestamp
  const formattedTimestamp = React.useMemo(() => {
    if (!timestamp) return "11 hours ago";
    try {
      const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return "11 hours ago";
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) return "Just now";
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "11 hours ago";
    }
  }, [timestamp]);

  // Get account initials for fallback
  const getAccountInitials = (): string => {
    if (socialAccount.displayName) {
      return socialAccount.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (socialAccount.username) {
      return socialAccount.username.slice(0, 2).toUpperCase();
    }
    return "AC";
  };

  // Format engagement numbers (Instagram style: 1.139K, 1.1M, etc.)
  const formatEngagement = (num?: number): string => {
    if (!num) return "0";
    if (num >= 1000000) {
      const millions = num / 1000000;
      return millions >= 10 
        ? `${Math.floor(millions)}M`
        : `${millions.toFixed(1)}M`;
    }
    if (num >= 1000) {
      const thousands = num / 1000;
      return thousands >= 10
        ? `${Math.floor(thousands)}K`
        : `${thousands.toFixed(1)}K`;
    }
    // Format with dots for thousands separator (e.g., 1.139)
    return num.toLocaleString("en-US").replace(/,/g, ".");
  };

  const defaultLikes = engagement?.likes ?? 1139;
  const defaultComments = engagement?.comments ?? 58;
  const defaultShares = engagement?.shares ?? 7;

  return (
    <div
      className={cn(
        "bg-white dark:bg-[#000000] rounded-lg border border-gray-300 dark:border-gray-800 overflow-hidden w-full",
        className
      )}
      style={{ 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 dark:border-gray-800">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Profile Picture */}
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10 border-2 border-gray-300 dark:border-gray-700">
              {socialAccount.avatarUrl ? (
                <AvatarImage
                  src={socialAccount.avatarUrl}
                  alt={socialAccount.displayName || socialAccount.username || "Account"}
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 text-white text-sm font-semibold">
                  {getAccountInitials()}
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          
          {/* Username and Verified Badge */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-semibold text-sm text-black dark:text-white truncate">
              {socialAccount.username || socialAccount.displayName || "username"}
            </span>
            {socialAccount.isVerified && (
              <div className="shrink-0 flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="12" fill="#0095F6" />
                  <path
                    d="M9.75 12l1.5 1.5 3-3"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Three Dots Menu */}
        <button
          type="button"
          className="shrink-0 p-1 hover:opacity-70 transition-opacity"
          aria-label="More options"
        >
          <MoreHorizontal className="h-6 w-6 text-black dark:text-white" />
        </button>
      </div>

      {/* Main Media */}
      <InstagramMediaCarousel media={media} caption={caption} />

      {/* Engagement Icons and Actions */}
      <div className="px-4 py-3 space-y-2">
        {/* Action Icons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="hover:opacity-70 transition-opacity"
              aria-label="Like"
            >
              <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            </button>
            <button
              type="button"
              className="hover:opacity-70 transition-opacity"
              aria-label="Comment"
            >
              <MessageCircle className="h-6 w-6 text-black dark:text-white" />
            </button>
            <button
              type="button"
              className="hover:opacity-70 transition-opacity"
              aria-label="Share"
            >
              <Send className="h-6 w-6 text-black dark:text-white" />
            </button>
          </div>
          <button
            type="button"
            className="hover:opacity-70 transition-opacity"
            aria-label="Save"
          >
            <Bookmark className="h-6 w-6 text-black dark:text-white" />
          </button>
        </div>

        {/* Caption */}
        <CaptionWithMore
          username={socialAccount.username || socialAccount.displayName || "username"}
          caption={caption}
        />

        {/* Timestamp */}
        <div className="pt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formattedTimestamp}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * CaptionWithMoreReel Component
 *
 * Renders caption with "more" toggle if text exceeds 2 lines (white text for reels)
 */
function CaptionWithMoreReel({ username, caption }: { username: string; caption?: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [needsMore, setNeedsMore] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fullTextRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (fullTextRef.current && caption) {
      // Measure the full text height
      const lineHeight = parseFloat(getComputedStyle(fullTextRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * 2;
      const fullHeight = fullTextRef.current.scrollHeight;

      setNeedsMore(fullHeight > maxHeight);
    }
  }, [caption]);

  if (!caption) {
    return (
      <div className="space-y-1">
        <div className="text-sm text-white break-words whitespace-pre-wrap">
          <span className="font-semibold">{username}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-sm text-white break-words" ref={containerRef}>
        {/* Hidden full text for measurement (including username) */}
        <div
          ref={fullTextRef}
          className="absolute opacity-0 pointer-events-none whitespace-pre-wrap text-sm"
          style={{
            visibility: "hidden",
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
            width: containerRef.current?.offsetWidth || "100%",
          }}
        >
          <span className="font-semibold">{username}</span>
          {" "}
          <CaptionText text={caption} />
        </div>
        {/* Visible caption text with username */}
        <span
          className="whitespace-pre-wrap"
          style={{
            display: isExpanded ? "inline" : "-webkit-box",
            WebkitLineClamp: isExpanded ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: isExpanded ? "visible" : "hidden",
          }}
        >
          <span className="font-semibold">{username}</span>
          {" "}
          <CaptionText text={caption} />
        </span>
        {needsMore && (
          <>
            {!isExpanded && "... "}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white/70 hover:text-white transition-colors"
            >
              {isExpanded ? "less" : "more"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Instagram Reel Preview
 *
 * Renders an Instagram reel preview with full-screen media and bottom overlay
 */
interface InstagramReelPreviewProps {
  socialAccount: ContentPreviewProps["socialAccount"];
  caption: string;
  media: ContentPreviewProps["media"];
  engagement?: ContentPreviewProps["engagement"];
  timestamp?: ContentPreviewProps["timestamp"];
  className?: string;
}

function InstagramReelPreview({
  socialAccount,
  caption,
  media = [],
  engagement,
  timestamp,
  className,
}: InstagramReelPreviewProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const currentMedia = media[currentIndex] || null;

  // Video handling
  React.useEffect(() => {
    if (currentMedia?.type === "video" && videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {
          // Video play failed
        });
      } else {
        videoRef.current.pause();
      }
      // Update muted state
      videoRef.current.muted = isMuted;
    }
  }, [currentMedia, isPlaying, isMuted]);

  // Toggle sound function
  const toggleSound = React.useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Format timestamp
  const formattedTimestamp = React.useMemo(() => {
    if (!timestamp) return "11h";
    try {
      const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return "11h";

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return "now";
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;

      return "7d+";
    } catch {
      return "11h";
    }
  }, [timestamp]);

  // Get account initials for fallback
  const getAccountInitials = (): string => {
    if (socialAccount.displayName) {
      return socialAccount.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (socialAccount.username) {
      return socialAccount.username.slice(0, 2).toUpperCase();
    }
    return "AC";
  };

  // Format engagement numbers (Instagram style: 1.139K, 1.1M, etc.)
  const formatEngagement = (num?: number): string => {
    if (!num) return "0";
    if (num >= 1000000) {
      const millions = num / 1000000;
      return millions >= 10
        ? `${Math.floor(millions)}M`
        : `${millions.toFixed(1)}M`;
    }
    if (num >= 1000) {
      const thousands = num / 1000;
      return thousands >= 10
        ? `${Math.floor(thousands)}K`
        : `${thousands.toFixed(1)}K`;
    }
    return num.toString();
  };

  const defaultLikes = engagement?.likes ?? 1139;
  const defaultComments = engagement?.comments ?? 58;
  const defaultShares = engagement?.shares ?? 7;

  return (
    <div
      className={cn(
        "bg-black relative rounded-lg overflow-hidden w-full",
        className
      )}
      style={{
        aspectRatio: "9 / 16",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Full screen media */}
      <div className="absolute inset-0">
        {currentMedia ? (
          currentMedia.type === "video" ? (
            <video
              ref={videoRef}
              src={currentMedia.url}
              className="absolute inset-0 w-full h-full object-cover"
              controls={false}
              playsInline
              loop={false}
              onEnded={() => {
                // Video bittiğinde baştan başlasın
                videoRef.current?.play();
              }}
            />
          ) : (
            <img
              src={currentMedia.url}
              alt="Instagram reel"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <p className="text-sm">No media</p>
          </div>
        )}
      </div>

      {/* Top overlay - Progress bars and sound toggle */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex justify-between items-start">
          {/* Progress bars for multiple media */}
          {media.length > 1 && (
            <div className="flex gap-1 h-0.5 flex-1">
              {media.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex-1 h-0.5 rounded-full",
                    index < currentIndex
                      ? "bg-white"
                      : index === currentIndex
                      ? "bg-white/60"
                      : "bg-white/30"
                  )}
                />
              ))}
            </div>
          )}

          {/* Sound toggle button - right side */}
          {currentMedia?.type === "video" && (
            <button
              type="button"
              onClick={toggleSound}
              className="opacity-60 hover:opacity-100 transition-opacity duration-200 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full p-2 ml-2"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-white" />
              ) : (
                <Volume2 className="h-5 w-5 text-white" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
        <div className="flex items-end justify-between w-full">
          {/* Left side - User info and caption */}
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-10 w-10 border-2 border-white">
                {socialAccount.avatarUrl ? (
                  <AvatarImage
                    src={socialAccount.avatarUrl}
                    alt={socialAccount.displayName || socialAccount.username || "Account"}
                  />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 text-white text-sm font-semibold">
                    {getAccountInitials()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white text-sm">
                  {socialAccount.username || socialAccount.displayName || "username"}
                </span>
                {socialAccount.isVerified && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="12" fill="#0095F6" />
                    <path
                      d="M9.75 12l1.5 1.5 3-3"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Caption */}
            {caption && (
              <div className="text-white">
                <CaptionWithMoreReel
                  username={socialAccount.username || socialAccount.displayName || "username"}
                  caption={caption}
                />
              </div>
            )}
          </div>

          {/* Right side - Action buttons */}
          <div className="flex flex-col items-center gap-4">
            {/* Like */}
            <button
              type="button"
              className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
              aria-label="Like"
            >
              <Heart className="h-6 w-6 text-white fill-white" />
              <span className="text-white text-xs font-medium">
                {formatEngagement(defaultLikes)}
              </span>
            </button>

            {/* Comment */}
            <button
              type="button"
              className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
              aria-label="Comment"
            >
              <MessageCircle className="h-6 w-6 text-white" />
              <span className="text-white text-xs font-medium">
                {formatEngagement(defaultComments)}
              </span>
            </button>

            {/* Share */}
            <button
              type="button"
              className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
              aria-label="Share"
            >
              <Send className="h-6 w-6 text-white" />
              <span className="text-white text-xs font-medium">
                {formatEngagement(defaultShares)}
              </span>
            </button>

            {/* More options */}
            <button
              type="button"
              className="hover:scale-110 transition-transform"
              aria-label="More options"
            >
              <MoreHorizontal className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation areas for multiple media */}
      {media.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => {
              setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
            }}
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
            aria-label="Previous"
          />
          <button
            type="button"
            onClick={() => {
              setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
            }}
            className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
            aria-label="Next"
          />
        </>
      )}
    </div>
  );
}

