"use client";

/**
 * Studio Brand Contents Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/contents
 * 
 * Content management page for the brand studio.
 */

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { format, isToday, isTomorrow, startOfDay, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useStudioBrand } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { useSocialAccounts } from "@/features/social-account/hooks";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { listPublications } from "@/shared/api/publication";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  List,
  Calendar,
  Plus,
  ExternalLink,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  MessageSquare,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarGroup } from "@/components/animate-ui/components/animate/avatar-group";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import { PLATFORM_INFO } from "@/features/social-account/types";
import {
  PreviewLinkCard,
  PreviewLinkCardTrigger,
  PreviewLinkCardContent,
} from "@/components/animate-ui/components/radix/preview-link-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentCard } from "@/features/content/components";
import { cn } from "@/shared/utils";

type ContentTab = "queue" | "drafts" | "approvals" | "published";

export default function StudioBrandContentsPage() {
  const { brand } = useStudioBrand();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<ContentTab>("queue");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch social accounts for platform filter
  const { accounts: socialAccounts } = useSocialAccounts({
    brandId: brand.id,
    status: "ACTIVE",
  });

  // Normalize platform names
  const normalizePlatform = (platform: string): string => {
    const platformKey = platform.toLowerCase();
    if (platformKey.includes("instagram")) return "instagram";
    if (platformKey.includes("facebook")) return "facebook";
    if (platformKey.includes("x") || platformKey.includes("twitter")) return "x";
    if (platformKey.includes("youtube")) return "youtube";
    if (platformKey.includes("tiktok")) return "tiktok";
    if (platformKey.includes("pinterest")) return "pinterest";
    if (platformKey.includes("linkedin")) return "linkedin";
    return platformKey.split("_")[0];
  };

  // Get available platforms
  const availablePlatforms = useMemo(() => {
    const platformSet = new Set<string>();
    if (socialAccounts && socialAccounts.length > 0) {
      socialAccounts.forEach((account) => {
        if (account.platform) {
          const normalized = normalizePlatform(account.platform);
          platformSet.add(normalized);
        }
      });
    }
    return Array.from(platformSet).sort();
  }, [socialAccounts]);

  // Mock tags - replace with actual data from API
  const availableTags = useMemo(() => ["Marketing", "Product", "Announcement", "Tutorial"], []);

  // Fetch draft publications from API
  const { data: draftPublicationsData, isLoading: isLoadingDrafts } = useQuery({
    queryKey: ["publications", "drafts", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return null;
      const response = await listPublications(brand.id, { 
        limit: 50,
        status: "draft"
      });
      return response.data.items;
    },
    enabled: !!brand?.id,
  });

  // Map API data to component format
  const draftContents = useMemo(() => {
    if (!draftPublicationsData) return [];
    
    console.log('📦 Draft publications data:', draftPublicationsData);
    
    return draftPublicationsData.map((pub) => {
      const mapped = {
        id: pub.id,
        socialAccountId: pub.socialAccountId,
        contentType: mapContentType(pub.contentType),
        caption: pub.caption || "",
        thumbnails: pub.mediaThumbnails || [],
        fullImages: pub.mediaUrls || [],
        scheduledDate: pub.scheduledAt ? new Date(pub.scheduledAt) : null,
      };
      
      console.log(`📸 Publication ${pub.id}: ${mapped.thumbnails.length} thumbnails, ${mapped.fullImages.length} full images`);
      
      return mapped;
    });
  }, [draftPublicationsData]);

  // Helper function to map API content types to component types
  function mapContentType(apiType: string): "story" | "post" | "carousel" | "reel" {
    const typeMap: Record<string, "story" | "post" | "carousel" | "reel"> = {
      // Lowercase (from Prisma enum)
      "story": "story",
      "image": "post",
      "feed_post": "post",
      "carousel": "carousel",
      "reel": "reel",
      "video": "reel",
      "link": "post",
      // Uppercase (backwards compatibility)
      "STORY": "story",
      "IMAGE": "post",
      "PHOTO": "post",
      "CAROUSEL": "carousel",
      "REEL": "reel",
      "VIDEO": "reel",
    };
    return typeMap[apiType] || "post";
  }


  const handleNewContent = useCallback(() => {
    router.push(`/${params.locale}/${params.workspace}/studio/${params.brand}/contents/new`);
  }, [router, params.locale, params.workspace, params.brand]);

  const handleViewChange = useCallback(
    (view: "list" | "calendar") => {
      if (!workspace?.slug) return;
      const localePrefix = locale === "en" ? "" : `/${locale}`;
      if (view === "calendar") {
        router.push(`${localePrefix}/${workspace.slug}/studio/${params.brand}/calendar`);
      } else {
        router.push(`${localePrefix}/${workspace.slug}/studio/${params.brand}/contents`);
      }
    },
    [router, locale, workspace?.slug, params.brand]
  );

  // Content card action handlers
  const handleEditContent = useCallback(() => {
    console.log("Edit content");
    // TODO: Navigate to edit page
  }, []);

  const handlePublishContent = useCallback(() => {
    console.log("Publish content");
    // TODO: Implement publish logic
  }, []);

  const handleAddToQueue = useCallback(() => {
    console.log("Add to queue");
    // TODO: Implement add to queue logic
  }, []);

  const handleDuplicateContent = useCallback(() => {
    console.log("Duplicate content");
    // TODO: Implement duplicate logic
  }, []);

  const handleDeleteContent = useCallback(() => {
    console.log("Delete content");
    // TODO: Implement delete logic
  }, []);

  // Group contents by scheduled date
  const groupedContents = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const groups: Record<
      string,
      Array<{
        id: string;
        socialAccountId: string | undefined;
        contentType: "story" | "post" | "carousel" | "reel";
        caption: string;
        thumbnails: string[];
        fullImages: string[];
        scheduledDate: Date | null;
      }>
    > = {
      unscheduled: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      nextWeek: [],
      later: [],
    };

    draftContents.forEach((content) => {
      if (!content.scheduledDate) {
        groups.unscheduled.push(content);
        return;
      }

      const scheduledDate = startOfDay(content.scheduledDate);
      const daysDiff = differenceInDays(scheduledDate, today);

      if (isToday(content.scheduledDate)) {
        groups.today.push(content);
      } else if (isTomorrow(content.scheduledDate)) {
        groups.tomorrow.push(content);
      } else if (daysDiff >= 2 && daysDiff <= 7) {
        groups.thisWeek.push(content);
      } else if (daysDiff >= 8 && daysDiff <= 14) {
        groups.nextWeek.push(content);
      } else {
        groups.later.push(content);
      }
    });

    return groups;
  }, [draftContents]);

  // Group labels
  const groupLabels: Record<string, string> = {
    today: "Today",
    tomorrow: "Tomorrow",
    thisWeek: "This Week",
    nextWeek: "Next Week",
    later: "Later",
    unscheduled: "Not Scheduled",
  };

  // Group order - Not Scheduled first
  const groupOrder = ["unscheduled", "today", "tomorrow", "thisWeek", "nextWeek", "later"];

  // Determine current view based on pathname
  const currentView = useMemo(() => {
    return pathname?.includes("/calendar") ? "calendar" : "list";
  }, [pathname]);

  // Set page header config
  const headerConfig = useMemo(
    () => ({
      title: "Contents",
      description: "Create and manage your brand's content library",
      actions: (
        <div className="flex items-center gap-2">
          <ButtonGroup orientation="horizontal">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewChange("list")}
              aria-label="List view"
              className={cn(
                currentView === "list" && "bg-primary/10 text-primary border-primary/20 [&_svg]:text-primary"
              )}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewChange("calendar")}
              aria-label="Calendar view"
              className={cn(
                currentView === "calendar" && "bg-primary/10 text-primary border-primary/20 [&_svg]:text-primary"
              )}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
          </ButtonGroup>
          <Button onClick={handleNewContent} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </div>
      ),
    }),
    [currentView, handleViewChange, handleNewContent]
  );

  useStudioPageHeader(headerConfig);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar with tabs and filters */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left side - Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentTab)}>
            <TabsList className="h-9">
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right side - Filters */}
          <div className="flex items-center gap-3">
            {/* Platform Filter */}
            {availablePlatforms.length > 0 && (
              <div className="flex items-center gap-2">
                {selectedPlatforms.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setSelectedPlatforms(new Set())}
                  >
                    Clear
                  </Button>
                )}
                <AvatarGroup className="h-8 -space-x-2">
                  {availablePlatforms.map((platform) => {
                    const isSelected = selectedPlatforms.has(platform);
                    const platformKey =
                      platform === "instagram"
                        ? "INSTAGRAM_BUSINESS"
                        : platform === "facebook"
                        ? "FACEBOOK_PAGE"
                        : platform === "linkedin"
                        ? "LINKEDIN_PAGE"
                        : platform === "twitter" || platform === "x"
                        ? "X_ACCOUNT"
                        : platform === "youtube"
                        ? "YOUTUBE_CHANNEL"
                        : platform === "tiktok"
                        ? "TIKTOK_BUSINESS"
                        : platform === "pinterest"
                        ? "PINTEREST_PROFILE"
                        : "X_ACCOUNT";

                    const platformAccount = socialAccounts.find((account) => {
                      const accountPlatform = account.platform.toLowerCase();
                      const platformLower = platform.toLowerCase();
                      return (
                        (platformLower === "instagram" && accountPlatform.includes("instagram")) ||
                        (platformLower === "facebook" && accountPlatform.includes("facebook")) ||
                        ((platformLower === "x" || platformLower === "twitter") &&
                          (accountPlatform.includes("x") || accountPlatform.includes("twitter"))) ||
                        (platformLower === "youtube" && accountPlatform.includes("youtube")) ||
                        (platformLower === "tiktok" && accountPlatform.includes("tiktok")) ||
                        (platformLower === "pinterest" && accountPlatform.includes("pinterest")) ||
                        (platformLower === "linkedin" && accountPlatform.includes("linkedin")) ||
                        accountPlatform.includes(platformLower) ||
                        platformLower.includes(accountPlatform.split("_")[0])
                      );
                    });

                    const avatarSrc = platformAccount?.avatarUrl || brand.logoUrl || undefined;

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

                    const fallbackText = platformAccount?.displayName
                      ? platformAccount.displayName.charAt(0).toUpperCase()
                      : platformAccount?.username
                      ? platformAccount.username.charAt(0).toUpperCase()
                      : platform.charAt(0).toUpperCase();

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
                          const newPlatforms = new Set(selectedPlatforms);
                          if (isSelected) {
                            newPlatforms.delete(platform);
                          } else {
                            newPlatforms.add(platform);
                          }
                          setSelectedPlatforms(newPlatforms);
                        }}
                      >
                        <Avatar className="w-8 h-8">
                          {avatarSrc && (
                            <AvatarImage
                              src={avatarSrc}
                              alt={platformAccount?.displayName || platform}
                            />
                          )}
                          <AvatarFallback className={cn(platformColor, "text-white")}>
                            <span className="text-xs font-semibold uppercase">{fallbackText}</span>
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <SocialPlatformIcon platform={platformKey} size={16} className="opacity-100" />
                        </div>
                      </div>
                    );

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
                            <div className="flex items-center gap-3 p-4 border-b">
                              <Avatar className="h-12 w-12 shrink-0">
                                {avatarSrc && (
                                  <AvatarImage
                                    src={avatarSrc}
                                    alt={platformAccount.displayName || platformAccount.username || ""}
                                  />
                                )}
                                <AvatarFallback className="bg-muted text-sm">
                                  {getAccountInitials()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold truncate">
                                  {platformAccount.displayName || platformAccount.username || "Unknown"}
                                </span>
                                {platformAccount.username && (
                                  <span className="text-sm text-muted-foreground truncate">
                                    @{platformAccount.username}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <SocialPlatformIcon platform={platformKey} size={20} />
                                <span className="text-sm text-muted-foreground">
                                  {platformInfo?.name || platform}
                                </span>
                              </div>
                              {platformAccount.profileUrl && (
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </PreviewLinkCardContent>
                        </PreviewLinkCard>
                      );
                    }

                    return <div key={platform}>{avatarElement}</div>;
                  })}
                </AvatarGroup>
              </div>
            )}

            {/* Tag Filter */}
            <Select
              value={selectedTag || "all"}
              onValueChange={(v) => setSelectedTag(v === "all" ? null : v)}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentTab)} className="h-full">
          <TabsContent value="queue" className="h-full">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Queue content will appear here
            </div>
          </TabsContent>
          <TabsContent value="drafts" className="h-full">
            {isLoadingDrafts ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading drafts...
              </div>
            ) : draftContents.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No drafts yet. Create your first content!
              </div>
            ) : (
              <div className="space-y-8 max-w-5xl mx-auto px-6">
                {groupOrder.map((groupKey) => {
                  const contents = groupedContents[groupKey];
                  if (contents.length === 0) return null;

                return (
                  <div key={groupKey} className="space-y-4">
                    {/* Group Header */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {groupLabels[groupKey]}
                      </h3>
                      <span className="text-xs text-muted-foreground">({contents.length})</span>
                    </div>

                    {/* Content Cards Grid - One per row */}
                    <div className="grid grid-cols-1 gap-4">
                      {contents.map((content) => {
                        if (!content.socialAccountId) return null;
                        const account = socialAccounts.find((acc) => acc.id === content.socialAccountId);
                        if (!account) return null;

                        return (
                          <ContentCard
                            key={content.id}
                            socialAccount={{
                              id: account.id,
                              platform: account.platform,
                              displayName: account.displayName,
                              username: account.username,
                              avatarUrl: account.avatarUrl,
                            }}
                            contentType={content.contentType}
                            caption={content.caption}
                            thumbnails={content.thumbnails}
                            fullImages={content.fullImages}
                            scheduledDate={content.scheduledDate}
                            onEdit={handleEditContent}
                            onPublish={handlePublishContent}
                            onAddToQueue={handleAddToQueue}
                            onDuplicate={handleDuplicateContent}
                            onDelete={handleDeleteContent}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="approvals" className="h-full">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Approvals will appear here
            </div>
          </TabsContent>
          <TabsContent value="published" className="h-full">
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Published content will appear here
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
