"use client"

import React from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export type SocialPlatform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "LINKEDIN"
  | "X"
  | "YOUTUBE"
  | "WHATSAPP"
  | "PINTEREST"

// Platform brand colors
const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  INSTAGRAM: "#E4405F", // Instagram pink/magenta
  FACEBOOK: "#1877F2", // Facebook blue
  TIKTOK: "#000000", // TikTok black
  LINKEDIN: "#0A66C2", // LinkedIn blue
  X: "#000000", // X/Twitter black
  YOUTUBE: "#FF0000", // YouTube red
  WHATSAPP: "#25D366", // WhatsApp green
  PINTEREST: "#BD081C", // Pinterest red
}

const PLATFORM_ICON_MAP: Record<SocialPlatform, { original: string; negative: string }> = {
  INSTAGRAM: {
    original: "/assets/social-media-icons/instagram-original.svg",
    negative: "/assets/social-media-icons/instagram-negative.svg",
  },
  FACEBOOK: {
    original: "/assets/social-media-icons/facebook-original.svg",
    negative: "/assets/social-media-icons/facebook-negative.svg",
  },
  TIKTOK: {
    original: "/assets/social-media-icons/tiktok-original.svg",
    negative: "/assets/social-media-icons/tiktok-negative.svg",
  },
  LINKEDIN: {
    original: "/assets/social-media-icons/linkedin-original.svg",
    negative: "/assets/social-media-icons/liknedin-negative.svg", // Typo in filename
  },
  X: {
    original: "/assets/social-media-icons/x-original.svg",
    negative: "/assets/social-media-icons/x-negative.svg",
  },
  YOUTUBE: {
    original: "/assets/social-media-icons/youtube-original.svg",
    negative: "/assets/social-media-icons/youtube-negative.svg",
  },
  WHATSAPP: {
    original: "/assets/social-media-icons/whatsapp-original.svg",
    negative: "/assets/social-media-icons/whatsapp-negative.svg",
  },
  PINTEREST: {
    original: "/assets/social-media-icons/pinterest-original.svg",
    negative: "/assets/social-media-icons/pinterest-negative.svg",
  },
}

export interface SocialPlatformIconProps {
  platform: SocialPlatform
  size?: number
  className?: string
  variant?: "original" | "negative"
}

export function SocialPlatformIcon({
  platform,
  size = 16,
  className,
  variant,
}: SocialPlatformIconProps) {
  const { theme } = useTheme()
  
  // Auto-detect variant based on theme if not explicitly provided
  const effectiveVariant = variant || (theme === "dark" ? "negative" : "original")
  const iconPath = PLATFORM_ICON_MAP[platform]?.[effectiveVariant] || PLATFORM_ICON_MAP[platform]?.original

  if (!iconPath) {
    // Fallback: platform name as text
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-muted text-xs font-medium",
          className
        )}
        style={{ width: size, height: size }}
      >
        {platform.substring(0, 1)}
      </div>
    )
  }

  return (
    <div
      className={cn("flex-shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={iconPath}
        alt={platform}
        width={size}
        height={size}
        className="w-full h-full object-contain"
      />
    </div>
  )
}

/**
 * Get platform brand color
 */
export function getPlatformColor(platform: SocialPlatform): string {
  return PLATFORM_COLORS[platform] || "#6B7280" // Default gray
}
