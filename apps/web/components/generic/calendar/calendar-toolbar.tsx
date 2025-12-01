"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Search, X, ChevronsUpDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink } from "lucide-react";
import { cn } from "@/shared/utils/index";
import { CalendarView } from "./index";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import { AvatarGroup } from "@/components/animate-ui/components/animate/avatar-group";
import {
  PreviewLinkCard,
  PreviewLinkCardTrigger,
  PreviewLinkCardContent,
} from "@/components/animate-ui/components/radix/preview-link-card";
import { PLATFORM_INFO } from "@/features/social-account/types";

interface CalendarToolbarProps {
  date: Date;
  view: CalendarView;
  availableViews: CalendarView[];
  onViewChange: (view: CalendarView) => void;
  onTodayClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onActionClick?: () => void;
  actionButtonLabel?: string;
  additionalActions?: React.ReactNode;
  compactView?: boolean;
  onCompactViewChange?: (compact: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  availablePlatforms?: string[];
  selectedPlatforms?: Set<string>;
  onPlatformsChange?: (platforms: Set<string>) => void;
  socialAccounts?: Array<{
    id: string;
    platform: string;
    avatarUrl?: string | null;
    displayName?: string | null;
    username?: string | null;
    profileUrl?: string | null;
  }>;
  brandLogoUrl?: string | null;
}

export function CalendarToolbar({
  date,
  view,
  availableViews,
  onViewChange,
  onTodayClick,
  onPrevClick,
  onNextClick,
  onActionClick,
  actionButtonLabel = "New Event",
  additionalActions,
  compactView = true,
  onCompactViewChange,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search events...",
  availablePlatforms = [],
  selectedPlatforms = new Set(),
  onPlatformsChange,
  socialAccounts = [],
  brandLogoUrl,
}: CalendarToolbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when expanded
  React.useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Collapse search when query is cleared (but keep it open if user is typing)
  React.useEffect(() => {
    // Don't auto-collapse if user just cleared it - let blur handle it
  }, [searchQuery]);

  const handleSearchClick = () => {
    setIsSearchExpanded(true);
  };

  const handleSearchBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if focus is moving to the clear button
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('button')) {
      return; // Don't collapse if clicking clear button
    }
    
    // Only collapse if there's no query
    if (!searchQuery) {
      // Small delay to allow clear button click to register
      setTimeout(() => {
        setIsSearchExpanded(false);
      }, 150);
    }
  };
  const getPeriodTitle = () => {
    switch (view) {
      case "month":
        return format(date, "MMMM yyyy");
      case "week":
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${format(startOfWeek, "MMM d")} - ${format(endOfWeek, "MMM d, yyyy")}`;
      case "3day":
        const startOf3Day = new Date(date);
        const endOf3Day = new Date(date);
        endOf3Day.setDate(date.getDate() + 2);
        return `${format(startOf3Day, "MMM d")} - ${format(endOf3Day, "MMM d, yyyy")}`;
      case "day":
        return format(date, "EEEE, MMMM d, yyyy");
      case "agenda":
        return format(date, "MMMM yyyy");
      default:
        return format(date, "MMMM yyyy");
    }
  };

  const getViewLabel = (view: CalendarView) => {
    switch (view) {
      case "month":
        return "Month";
      case "week":
        return "Week";
      case "3day":
        return "3 Day";
      case "day":
        return "Day";
      case "agenda":
        return "Agenda";
      default:
        return "Month";
    }
  };

  return (
    <div className="flex flex-col border-b bg-background">
      {/* Main toolbar row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Today button and navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onTodayClick}
            className="hidden sm:flex h-[34px]"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevClick}
              className="h-[34px] w-[34px] p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextClick}
              className="h-[34px] w-[34px] p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold ml-2">
            {getPeriodTitle()}
          </h2>
        </div>

        {/* Desktop - Right side - Search, View selector and action button */}
        <div className="hidden md:flex items-center gap-2">
          {additionalActions}

          {/* Platform Filter - Avatar Group */}
          {availablePlatforms.length > 0 && (
            <div className="flex items-center gap-2">
              {selectedPlatforms.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[34px] px-2 text-xs"
                  onClick={() => onPlatformsChange?.(new Set())}
                >
                  Clear
                </Button>
              )}
              <AvatarGroup className="h-8 -space-x-2">
                {availablePlatforms.map((platform) => {
                  const isSelected = selectedPlatforms.has(platform);
                  // Map publication platform names to SocialPlatform enum values
                  const platformKey = 
                    platform === "instagram" ? "INSTAGRAM_BUSINESS" :
                    platform === "facebook" ? "FACEBOOK_PAGE" :
                    platform === "linkedin" ? "LINKEDIN_PAGE" :
                    platform === "twitter" || platform === "x" ? "X_ACCOUNT" :
                    platform === "youtube" ? "YOUTUBE_CHANNEL" :
                    platform === "tiktok" ? "TIKTOK_BUSINESS" :
                    platform === "pinterest" ? "PINTEREST_PROFILE" :
                    "X_ACCOUNT"; // Default fallback
                  
                  // Find social account for this platform
                  // Match platform string to account platform key
                  const platformAccount = socialAccounts.find(account => {
                    const accountPlatform = account.platform.toLowerCase();
                    const platformLower = platform.toLowerCase();
                    return (
                      (platformLower === 'instagram' && accountPlatform.includes('instagram')) ||
                      (platformLower === 'facebook' && accountPlatform.includes('facebook')) ||
                      ((platformLower === 'x' || platformLower === 'twitter') && (accountPlatform.includes('x') || accountPlatform.includes('twitter'))) ||
                      (platformLower === 'youtube' && accountPlatform.includes('youtube')) ||
                      (platformLower === 'tiktok' && accountPlatform.includes('tiktok')) ||
                      (platformLower === 'pinterest' && accountPlatform.includes('pinterest')) ||
                      (platformLower === 'linkedin' && accountPlatform.includes('linkedin')) ||
                      accountPlatform.includes(platformLower) ||
                      platformLower.includes(accountPlatform.split('_')[0])
                    );
                  });
                  
                  // Avatar priority: account avatar > brand logo > platform color fallback
                  const avatarSrc = platformAccount?.avatarUrl || brandLogoUrl || undefined;
                  
                  // Platform renkleri (fallback için)
                  const platformColors: Record<string, string> = {
                    instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500",
                    facebook: "bg-blue-600",
                    linkedin: "bg-blue-700",
                    x: "bg-black",
                    twitter: "bg-black",
                    youtube: "bg-red-600",
                    tiktok: "bg-black",
                    pinterest: "bg-red-600",
                  };
                  
                  const platformColor = platformColors[platform.toLowerCase()] || "bg-muted";
                  
                  // Fallback text
                  const fallbackText = platformAccount?.displayName 
                    ? platformAccount.displayName.charAt(0).toUpperCase()
                    : platformAccount?.username 
                    ? platformAccount.username.charAt(0).toUpperCase()
                    : platform.charAt(0).toUpperCase();
                  
                  // Get account initials for preview
                  const getAccountInitials = () => {
                    if (!platformAccount) return platform.charAt(0).toUpperCase();
                    const name = platformAccount.displayName || platformAccount.username || "??";
                    const parts = name.split(" ");
                    if (parts.length >= 2) {
                      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    }
                    return name.substring(0, 2).toUpperCase();
                  };
                  
                  const platformInfo = PLATFORM_INFO[platformKey as keyof typeof PLATFORM_INFO];
                  
                  const avatarElement = (
                    <div
                      className={cn(
                        "relative rounded-full border-2 cursor-pointer transition-all",
                        isSelected 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "border-background hover:border-primary/50",
                        selectedPlatforms.size > 0 && !isSelected && "opacity-50"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!onPlatformsChange) return;
                        const newPlatforms = new Set(selectedPlatforms);
                        if (isSelected) {
                          newPlatforms.delete(platform);
                        } else {
                          newPlatforms.add(platform);
                        }
                        onPlatformsChange(newPlatforms);
                      }}
                    >
                      <Avatar className="w-8 h-8">
                        {avatarSrc && (
                          <AvatarImage src={avatarSrc} alt={platformAccount?.displayName || platform} />
                        )}
                        <AvatarFallback className={cn(platformColor, "text-white")}>
                          <span className="text-xs font-semibold uppercase">
                            {fallbackText}
                          </span>
                        </AvatarFallback>
                      </Avatar>
                      {/* Platform icon at bottom right */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-background border-2 border-background flex items-center justify-center">
                        <SocialPlatformIcon
                          platform={platformKey}
                          size={16}
                          className="opacity-100"
                        />
                      </div>
                    </div>
                  );

                  // If platform account exists, wrap with PreviewLinkCard
                  if (platformAccount) {
                    return (
                      <PreviewLinkCard key={platform}>
                        <PreviewLinkCardTrigger
                          href={platformAccount.profileUrl || undefined}
                          className="no-underline hover:no-underline inline-block"
                        >
                          {avatarElement}
                        </PreviewLinkCardTrigger>
                        <PreviewLinkCardContent>
                          {/* Profile header with avatar */}
                          <div className="flex items-center gap-3 p-4 border-b">
                            <Avatar className="h-12 w-12 shrink-0">
                              {avatarSrc && (
                                <AvatarImage src={avatarSrc} alt={platformAccount.displayName || platformAccount.username || ""} />
                              )}
                              <AvatarFallback className="bg-muted text-sm">
                                {getAccountInitials()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold truncate">{platformAccount.displayName || platformAccount.username || "Unknown"}</span>
                              {platformAccount.username && (
                                <span className="text-sm text-muted-foreground truncate">@{platformAccount.username}</span>
                              )}
                            </div>
                          </div>
                          {/* Platform info */}
                          <div className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <SocialPlatformIcon platform={platformKey} size={20} />
                              <span className="text-sm text-muted-foreground">{platformInfo?.name || platform}</span>
                            </div>
                            {platformAccount.profileUrl && (
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </PreviewLinkCardContent>
                      </PreviewLinkCard>
                    );
                  }

                  // If no platform account, just render the avatar without preview
                  return (
                    <div key={platform}>
                      {avatarElement}
                    </div>
                  );
                })}
              </AvatarGroup>
            </div>
          )}

          {/* Expandable Search - Before view selector */}
          <div className="relative flex items-center">
            <AnimatePresence mode="wait">
              {!isSearchExpanded ? (
                <motion.div
                  key="search-icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[34px] w-[34px] p-0"
                    onClick={handleSearchClick}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="search-input"
                  initial={{ width: 34, opacity: 0 }}
                  animate={{ width: 200, opacity: 1 }}
                  exit={{ width: 34, opacity: 0 }}
                  transition={{ 
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1] // ease-out cubic bezier
                  }}
                  className={cn(
                    "relative flex items-center overflow-hidden h-[34px]",
                    "bg-background border border-input rounded-md"
                  )}
                >
                  <Search className="absolute left-2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    onBlur={handleSearchBlur}
                    className="h-[34px] pl-8 pr-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 py-0"
                  />
                  {searchQuery && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSearchChange?.("");
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-2 text-muted-foreground hover:text-foreground z-10"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View selector dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-[34px]">
                {getViewLabel(view)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {availableViews.map((viewOption) => (
                <DropdownMenuItem
                  key={viewOption}
                  onClick={() => onViewChange(viewOption)}
                  className={view === viewOption ? "bg-accent" : ""}
                >
                  {getViewLabel(viewOption)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action button */}
          {onActionClick && (
            <Button
              onClick={onActionClick}
              size="sm"
              className="h-[34px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              {actionButtonLabel}
            </Button>
          )}

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-[34px] w-[34px] p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>View Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm">Compact View</span>
                <Switch
                  checked={compactView}
                  onCheckedChange={onCompactViewChange}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile - Right side - Action button and menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          {onActionClick && (
            <Button
              onClick={onActionClick}
              size="sm"
              className="h-[34px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              {actionButtonLabel}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            className="h-[34px] w-[34px] p-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile - Expandable menu row */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden md:hidden border-t"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              {additionalActions}
              
              {/* Search */}
              <div className="relative flex items-center">
                <div className="relative flex items-center w-full">
                  <Search className="absolute left-2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    className="h-[34px] pl-8 pr-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange?.("")}
                      className="absolute right-2 text-muted-foreground hover:text-foreground z-10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* View selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-[34px] w-full justify-start">
                    {getViewLabel(view)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                  {availableViews.map((viewOption) => (
                    <DropdownMenuItem
                      key={viewOption}
                      onClick={() => onViewChange(viewOption)}
                      className={view === viewOption ? "bg-accent" : ""}
                    >
                      {getViewLabel(viewOption)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Platform Filter */}
              {availablePlatforms.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Platform Filter</div>
                  <div className="space-y-1.5">
                    {availablePlatforms.map((platform) => {
                      const isSelected = selectedPlatforms.has(platform);
                      // Map publication platform names to SocialPlatform enum values
                      const platformKey = 
                        platform === "instagram" ? "INSTAGRAM_BUSINESS" :
                        platform === "facebook" ? "FACEBOOK_PAGE" :
                        platform === "linkedin" ? "LINKEDIN_PAGE" :
                        platform === "twitter" || platform === "x" ? "X_ACCOUNT" :
                        platform === "youtube" ? "YOUTUBE_CHANNEL" :
                        platform === "tiktok" ? "TIKTOK_BUSINESS" :
                        platform === "pinterest" ? "PINTEREST_PROFILE" :
                        "X_ACCOUNT"; // Default fallback
                      
                      return (
                        <div
                          key={platform}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
                          onClick={() => {
                            if (!onPlatformsChange) return;
                            const newPlatforms = new Set(selectedPlatforms);
                            if (isSelected) {
                              newPlatforms.delete(platform);
                            } else {
                              newPlatforms.add(platform);
                            }
                            onPlatformsChange(newPlatforms);
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              if (!onPlatformsChange) return;
                              const newPlatforms = new Set(selectedPlatforms);
                              if (isSelected) {
                                newPlatforms.delete(platform);
                              } else {
                                newPlatforms.add(platform);
                              }
                              onPlatformsChange(newPlatforms);
                            }}
                          />
                          <SocialPlatformIcon
                            platform={platformKey}
                            size={16}
                            className="opacity-80"
                          />
                          <span className="text-sm capitalize flex-1">{platform}</span>
                        </div>
                      );
                    })}
                  </div>
                  {selectedPlatforms.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-[34px] w-full text-sm"
                      onClick={() => onPlatformsChange?.(new Set())}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}

              {/* Settings */}
              <div className="flex items-center justify-between px-3 py-2 rounded-md border">
                <span className="text-sm">Compact View</span>
                <Switch
                  checked={compactView}
                  onCheckedChange={onCompactViewChange}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
