"use client";

import { useMemo, useState, useCallback } from "react";
import * as React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudioPageHeader } from "@/features/studio/context";
import { useStudioBrand } from "@/features/studio/hooks";
import { useSocialAccounts } from "@/features/social-account/hooks";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { presignUpload, finalizeUpload, getMediaConfig, type MediaConfig } from "@/shared/api/media";
import { createInstagramPublication, createFacebookPublication } from "@/shared/api/publication";
import { useToast } from "@/components/ui/use-toast";
import { PLATFORM_INFO } from "@/features/social-account/types";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import { CaptionEditorExtensions } from "./caption-editor-extensions";
import {
  ImageIcon,
  ImagesIcon,
  VideoIcon,
  CircleDotIcon,
  CheckIcon,
  Upload,
  ImagePlus,
  Film,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/shared/utils";
import {
  type AppContentType,
  type PlatformId,
  getPlatformMapping,
  isPlatformSupported,
  getPlatformTypeLabel,
  mapSocialPlatformToPlatformId,
} from "@/shared/content/content-type-matrix";
import * as TagsInput from "@diceui/tags-input";

// Content type definitions (matching matrix)
const CONTENT_TYPES: Array<{
  id: AppContentType;
  name: string;
  description: string;
  icon: typeof ImageIcon;
}> = [
  {
    id: "single_post",
    name: "Single post",
    description: "A single image or text post",
    icon: ImageIcon,
  },
  {
    id: "carousel",
    name: "Carousel",
    description: "Multiple images in a swipeable gallery",
    icon: ImagesIcon,
  },
  {
    id: "vertical_video",
    name: "Reel / Short",
    description: "Short-form vertical video",
    icon: VideoIcon,
  },
  {
    id: "story",
    name: "Story",
    description: "24-hour ephemeral content",
    icon: CircleDotIcon,
  },
] as const;

/**
 * Content Create Page Layout
 *
 * A resizable two-panel layout for creating new content:
 * - Left panel (60%): Content settings form with tabs
 * - Right panel (40%): Preview placeholder
 */
interface SelectedMedia {
  file: File;
  previewUrl: string;
  mediaId?: string;
  objectKey?: string;
  uploading?: boolean;
}

export function ContentCreatePage() {
  const { brand } = useStudioBrand();
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedContentType, setSelectedContentType] = useState<AppContentType | null>(null);
  const [customizePerPlatform, setCustomizePerPlatform] = useState(false);
  const [baseCaption, setBaseCaption] = useState("");
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [mediaConfig, setMediaConfig] = useState<MediaConfig | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Fetch social accounts for this brand
  const { accounts } = useSocialAccounts({
    brandId: brand?.id,
    status: "ACTIVE",
  });

  // Load media config
  React.useEffect(() => {
    getMediaConfig().then(setMediaConfig).catch(console.error);
  }, []);

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newMedia: SelectedMedia[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported image or video file`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file size
      if (mediaConfig) {
        const assetType = isVideo ? "content-video" : "content-image";
        const limits = mediaConfig.assets[assetType as keyof typeof mediaConfig.assets]?.limits;
        if (limits && file.size > limits.maxFileSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds maximum size of ${(limits.maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB`,
            variant: "destructive",
          });
          continue;
        }
      }
      
      // Create blob URL for preview
      const previewUrl = URL.createObjectURL(file);
      
      newMedia.push({
        file,
        previewUrl,
      });
    }

    if (newMedia.length > 0) {
      setSelectedMedia((prev) => [...prev, ...newMedia]);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  // Handle file upload (will be called when posting)
  const handleMediaUpload = useCallback(async (mediaItem: SelectedMedia): Promise<string | null> => {
    if (!workspaceReady || !workspace?.id || !brand?.id) {
      toast({
        title: "Error",
        description: "Workspace and brand must be ready to upload media",
        variant: "destructive",
      });
      return null;
    }

    if (mediaItem.mediaId) {
      // Already uploaded
      return mediaItem.mediaId;
    }

    try {
      // Determine asset type
      const isVideo = mediaItem.file.type.startsWith("video/");
      const assetType = isVideo ? "content-video" : "content-image";

      // Get presigned URL
      const presign = await presignUpload({
        workspaceId: workspace.id,
        brandId: brand.id,
        fileName: mediaItem.file.name,
        contentType: mediaItem.file.type,
        sizeBytes: mediaItem.file.size,
        assetType,
      });

      // Upload to S3
      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mediaItem.file.type,
        },
        body: mediaItem.file,
      });

      // Finalize upload with isPublic: true
      const finalize = await finalizeUpload({
        objectKey: presign.objectKey,
        workspaceId: workspace.id,
        brandId: brand.id,
        originalName: mediaItem.file.name,
        contentType: mediaItem.file.type,
        assetType,
        isPublic: true,
      });

      // Update media item with mediaId
      setSelectedMedia((prev) =>
        prev.map((item) =>
          item === mediaItem
            ? { ...item, mediaId: finalize.media.id, objectKey: presign.objectKey }
            : item
        )
      );

      return finalize.media.id;
    } catch (error) {
      console.error("Failed to upload media:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload media",
        variant: "destructive",
      });
      return null;
    }
  }, [workspaceReady, workspace?.id, brand?.id, toast]);

  // Remove media
  const handleRemoveMedia = (mediaItem: SelectedMedia) => {
    // Revoke blob URL to free memory
    URL.revokeObjectURL(mediaItem.previewUrl);
    setSelectedMedia((prev) => prev.filter((item) => item !== mediaItem));
  };

  // Cleanup blob URLs on unmount
  React.useEffect(() => {
    return () => {
      selectedMedia.forEach((media) => {
        URL.revokeObjectURL(media.previewUrl);
      });
    };
  }, [selectedMedia]);

  // Filter accounts based on selected content type
  const filteredAccounts = useMemo(() => {
    if (!selectedContentType) {
      return accounts;
    }

    return accounts.filter((account) => {
      const platformId = mapSocialPlatformToPlatformId(account.platform);
      if (!platformId) return false;

      return isPlatformSupported(selectedContentType, platformId, {
        includeDegraded: true,
      });
    });
  }, [accounts, selectedContentType]);

  // Get selected accounts for display
  const selectedAccountsList = useMemo(() => {
    return filteredAccounts.filter((account) =>
      selectedAccounts.has(account.id)
    );
  }, [filteredAccounts, selectedAccounts]);

  // Get unique platforms from selected accounts
  const selectedPlatforms = useMemo(() => {
    const platforms = new Map<PlatformId, { platformId: PlatformId; accounts: typeof filteredAccounts }>();
    
    selectedAccountsList.forEach((account) => {
      const platformId = mapSocialPlatformToPlatformId(account.platform);
      if (platformId) {
        const existing = platforms.get(platformId);
        if (existing) {
          existing.accounts.push(account);
        } else {
          platforms.set(platformId, {
            platformId,
            accounts: [account],
          });
        }
      }
    });
    
    return Array.from(platforms.values());
  }, [selectedAccountsList]);

  // Toggle account selection
  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Map AppContentType to Instagram/Facebook content types
  const mapContentTypeToInstagram = (contentType: AppContentType): "IMAGE" | "CAROUSEL" | "REEL" | "STORY" => {
    switch (contentType) {
      case "single_post":
        return "IMAGE";
      case "carousel":
        return "CAROUSEL";
      case "vertical_video":
        return "REEL";
      case "story":
        return "STORY";
      default:
        return "IMAGE";
    }
  };

  const mapContentTypeToFacebook = (contentType: AppContentType): "PHOTO" | "VIDEO" | "LINK" | "STORY" | "CAROUSEL" => {
    switch (contentType) {
      case "single_post":
        return "PHOTO";
      case "carousel":
        return "CAROUSEL"; // Facebook carousel needs CAROUSEL content type
      case "vertical_video":
        return "VIDEO";
      case "story":
        return "STORY";
      default:
        return "PHOTO";
    }
  };

  // Handle publish
  const handlePublish = useCallback(async () => {
    if (!workspaceReady || !workspace?.id || !brand?.id) {
      toast({
        title: "Error",
        description: "Workspace and brand must be ready",
        variant: "destructive",
      });
      return;
    }

    if (!selectedContentType) {
      toast({
        title: "Error",
        description: "Please select a content type",
        variant: "destructive",
      });
      return;
    }

    if (selectedAccounts.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one account",
        variant: "destructive",
      });
      return;
    }

    // Filter only Instagram and Facebook accounts
    const publishableAccounts = selectedAccountsList.filter(
      (account) =>
        account.platform === "INSTAGRAM_BUSINESS" ||
        account.platform === "INSTAGRAM_BASIC" ||
        account.platform === "FACEBOOK_PAGE"
    );

    if (publishableAccounts.length === 0) {
      toast({
        title: "Error",
        description: "Only Instagram and Facebook accounts are supported for publishing",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);

    try {
      // Upload all media first
      const mediaIds: string[] = [];
      for (const mediaItem of selectedMedia) {
        const mediaId = await handleMediaUpload(mediaItem);
        if (mediaId) {
          mediaIds.push(mediaId);
        }
      }

      if (selectedMedia.length > 0 && mediaIds.length === 0) {
        toast({
          title: "Error",
          description: "Failed to upload media",
          variant: "destructive",
        });
        setIsPublishing(false);
        return;
      }

      // Calculate publishAt (if scheduled)
      let publishAt: string | undefined;
      if (scheduleForLater && scheduledDate && scheduledTime) {
        const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (!isNaN(dateTime.getTime())) {
          publishAt = dateTime.toISOString();
        }
      }
      // If not scheduled and "Publish Now", publishAt is undefined (immediate)

      // Get caption (platform-specific or base)
      const getCaption = (account: typeof publishableAccounts[0]): string => {
        const platformId = mapSocialPlatformToPlatformId(account.platform);
        if (platformId && customizePerPlatform && platformCaptions[platformId]) {
          return platformCaptions[platformId];
        }
        return baseCaption;
      };

      // Create publications for each account
      const publications = await Promise.allSettled(
        publishableAccounts.map(async (account) => {
          const platformId = mapSocialPlatformToPlatformId(account.platform);
          if (!platformId) return;

          const caption = getCaption(account);
          const isInstagram = account.platform === "INSTAGRAM_BUSINESS" || account.platform === "INSTAGRAM_BASIC";
          const isFacebook = account.platform === "FACEBOOK_PAGE";

          if (isInstagram) {
            const instagramContentType = mapContentTypeToInstagram(selectedContentType);
            const payload: any = {
              contentType: instagramContentType,
            };

            if (caption && selectedContentType !== "story") {
              payload.caption = caption;
            }

            // Add media IDs based on content type
            if (selectedMedia.length > 0) {
              if (instagramContentType === "CAROUSEL") {
                // Carousel items need mediaId and type (matching Zod schema)
                payload.items = mediaIds.map((mediaId) => {
                  const mediaItem = selectedMedia.find((m) => m.mediaId === mediaId);
                  const isVideo = mediaItem?.file.type.startsWith("video/");
                  return {
                    mediaId,
                    type: isVideo ? "VIDEO" : "IMAGE",
                  };
                });
              } else if (instagramContentType === "REEL") {
                payload.videoMediaId = mediaIds[0];
              } else if (instagramContentType === "STORY") {
                // Story requires storyType field
                const firstMedia = selectedMedia[0];
                const isVideo = firstMedia?.file.type.startsWith("video/");
                payload.storyType = isVideo ? "VIDEO" : "IMAGE";
                if (isVideo) {
                  payload.videoMediaId = mediaIds[0];
                } else {
                  payload.imageMediaId = mediaIds[0];
                }
              } else {
                // IMAGE content type
                payload.imageMediaId = mediaIds[0];
              }
            }

            return createInstagramPublication(brand.id, {
              socialAccountId: account.id,
              publishAt,
              payload,
            });
          } else if (isFacebook) {
            const facebookContentType = mapContentTypeToFacebook(selectedContentType);
            const payload: any = {
              contentType: facebookContentType,
            };

            if (caption && selectedContentType !== "story") {
              payload.message = caption;
            }

            // Add media IDs based on content type
            if (selectedMedia.length > 0) {
              if (facebookContentType === "STORY") {
                // Story requires storyType field
                const firstMedia = selectedMedia[0];
                const isVideo = firstMedia?.file.type.startsWith("video/");
                payload.storyType = isVideo ? "VIDEO" : "IMAGE";
                if (isVideo) {
                  payload.videoMediaId = mediaIds[0];
                } else {
                  payload.imageMediaId = mediaIds[0];
                }
    } else if (facebookContentType === "VIDEO") {
      payload.videoMediaId = mediaIds[0];
    } else if (facebookContentType === "CAROUSEL") {
      // Carousel items need mediaId and type (matching backend schema)
      payload.items = mediaIds.map((mediaId) => {
        const mediaItem = selectedMedia.find((m) => m.mediaId === mediaId);
        const isVideo = mediaItem?.file.type.startsWith("video/");
        return {
          mediaId,
          type: isVideo ? "VIDEO" : "IMAGE",
        };
      });
    } else {
      // PHOTO or LINK content type
      payload.imageMediaId = mediaIds[0];
    }
            }

            return createFacebookPublication(brand.id, {
              socialAccountId: account.id,
              publishAt,
              payload,
            });
          }
        })
      );

      // Check results
      const successful = publications.filter((p) => p.status === "fulfilled").length;
      const failed = publications.filter((p) => p.status === "rejected").length;

      if (successful > 0) {
        toast({
          title: "İşleme alındı",
          description: `${successful} hesap${successful > 1 ? "" : ""} için yayınlama işlemi başlatıldı${failed > 0 ? ` (${failed} hesap için başarısız)` : ""}`,
        });
        // TODO: Navigate to content list or show success page
      } else {
        toast({
          title: "Hata",
          description: "Hiçbir hesap için yayınlama işlemi başlatılamadı",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }, [
    workspaceReady,
    workspace?.id,
    brand?.id,
    selectedContentType,
    selectedAccounts,
    selectedAccountsList,
    selectedMedia,
    scheduleForLater,
    scheduledDate,
    scheduledTime,
    customizePerPlatform,
    platformCaptions,
    baseCaption,
    handleMediaUpload,
    toast,
  ]);

  // Set page header config (after handlePublish is defined)
  // Must include handlePublish in deps - it changes when selectedContentType/accounts change
  const headerConfig = useMemo(
    () => ({
      title: "New Content",
      description:
        "Create a new content and prepare it for publishing across your social accounts.",
      actions: (
        <div className="flex items-center gap-3">
          <Button variant="link" size="sm" className="text-muted-foreground">
            İptal
          </Button>
          <Button variant="outline" size="sm">
            Taslak Kaydet
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? "Publishing..." : "Publish Now"}
            <Send className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
    }),
    [isPublishing, handlePublish]
  );

  useStudioPageHeader(headerConfig);

  return (
    <div className="flex h-full flex-col">
      {/* Main Resizable Area - Edge to edge */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Content Settings with Tabs */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <div className="flex h-full flex-col border-r">
            <Tabs defaultValue="settings" className="flex h-full flex-col">
              {/* Tabs Header */}
              <div className="border-b px-6 py-3">
                <TabsList>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                </TabsList>
              </div>

              {/* Settings Tab - Only Content Type and Platforms */}
              <TabsContent value="settings" className="flex-1 overflow-hidden m-0">
                <div className="h-full space-y-6 overflow-y-auto px-6 py-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" placeholder="Summer campaign launch post" />
                  </div>

                  {/* Content Type - Card Selection */}
                  <div className="space-y-3">
                    <Label>Content type</Label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {CONTENT_TYPES.map((type) => (
                        <ContentTypeCard
                          key={type.id}
                          type={type}
                          selected={selectedContentType === type.id}
                          onSelect={() => setSelectedContentType(type.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Account Selection Dropdown */}
                  <div className="space-y-2">
                    <Label>Select which accounts to publish to</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto min-h-10 px-3 py-2"
                        >
                          {selectedAccountsList.length === 0 ? (
                            <span className="text-muted-foreground">
                              Select accounts...
                            </span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Platform icons stack */}
                              <div className="flex items-center -space-x-2">
                                {selectedAccountsList.slice(0, 3).map((account) => (
                                  <div
                                    key={account.id}
                                    className="relative z-10 rounded-full ring-2 ring-background"
                                  >
                                    <SocialPlatformIcon
                                      platform={account.platform}
                                      size={20}
                                      className="rounded-full"
                                    />
                                  </div>
                                ))}
                                {selectedAccountsList.length > 3 && (
                                  <div className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                                    +{selectedAccountsList.length - 3}
                                  </div>
                                )}
                              </div>
                              {/* Account names */}
                              <span className="text-sm">
                                {selectedAccountsList
                                  .slice(0, 2)
                                  .map((a) => a.displayName || a.username)
                                  .join(", ")}
                                {selectedAccountsList.length > 2 &&
                                  ` ve ${selectedAccountsList.length - 2} diğeri`}
                              </span>
                            </div>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto">
                        {filteredAccounts.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No accounts available
                          </div>
                        ) : (
                          <>
                            <DropdownMenuCheckboxItem
                              checked={
                                selectedAccountsList.length ===
                                filteredAccounts.length &&
                                filteredAccounts.length > 0
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAccounts(
                                    new Set(filteredAccounts.map((a) => a.id))
                                  );
                                } else {
                                  setSelectedAccounts(new Set());
                                }
                              }}
                            >
                              Select all
                            </DropdownMenuCheckboxItem>
                            {filteredAccounts.map((account) => {
                              const platformId = mapSocialPlatformToPlatformId(account.platform);
                              const mapping = platformId && selectedContentType
                                ? getPlatformMapping(selectedContentType, platformId)
                                : null;
                              const platformTypeLabel = platformId && selectedContentType
                                ? getPlatformTypeLabel(selectedContentType, platformId)
                                : null;

                              // Format platform type label for display
                              const formatPlatformTypeLabel = (label: string | null): string => {
                                if (!label) return "";
                                return label
                                  .split("_")
                                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                  .join(" ");
                              };

                              return (
                                <TooltipProvider key={account.id}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-full">
                                        <DropdownMenuCheckboxItem
                                          checked={selectedAccounts.has(account.id)}
                                          onCheckedChange={() => {
                                            toggleAccount(account.id);
                                          }}
                                          className="w-full"
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <SocialPlatformIcon
                                              platform={account.platform}
                                              size={16}
                                            />
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="truncate">
                                                {account.displayName || account.username}
                                              </span>
                                              {account.username && (
                                                <span className="text-xs text-muted-foreground truncate">
                                                  @{account.username}
                                                </span>
                                              )}
                                              {platformTypeLabel && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs h-5 px-1.5 font-normal shrink-0"
                                                >
                                                  {formatPlatformTypeLabel(platformTypeLabel)}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </DropdownMenuCheckboxItem>
                                      </div>
                                    </TooltipTrigger>
                                    {mapping?.notes && (
                                      <TooltipContent side="right" className="max-w-xs">
                                        <p className="text-sm">{mapping.notes}</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Content Details */}
                  {selectedContentType && (selectedContentType as string) !== "story" && (
                    <div className="space-y-4">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const newValue = !customizePerPlatform;
                          setCustomizePerPlatform(newValue);
                          // When switching to per-platform, pre-fill all tabs with base caption
                          if (newValue && baseCaption && selectedPlatforms.length > 0) {
                            const newPlatformCaptions: Record<string, string> = {};
                            selectedPlatforms.forEach(({ platformId }) => {
                              // Only pre-fill if platform caption is empty
                              if (!platformCaptions[platformId]) {
                                newPlatformCaptions[platformId] = baseCaption;
                              }
                            });
                            if (Object.keys(newPlatformCaptions).length > 0) {
                              setPlatformCaptions((prev) => ({
                                ...prev,
                                ...newPlatformCaptions,
                              }));
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const newValue = !customizePerPlatform;
                            setCustomizePerPlatform(newValue);
                            // When switching to per-platform, pre-fill all tabs with base caption
                            if (newValue && baseCaption && selectedPlatforms.length > 0) {
                              const newPlatformCaptions: Record<string, string> = {};
                              selectedPlatforms.forEach(({ platformId }) => {
                                // Only pre-fill if platform caption is empty
                                if (!platformCaptions[platformId]) {
                                  newPlatformCaptions[platformId] = baseCaption;
                                }
                              });
                              if (Object.keys(newPlatformCaptions).length > 0) {
                                setPlatformCaptions((prev) => ({
                                  ...prev,
                                  ...newPlatformCaptions,
                                }));
                              }
                            }
                          }
                        }}
                        className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 hover:border-primary/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-0.5 flex-1">
                            <Label className="pointer-events-none">Gönderiyi platformlara ayrı özelleştir</Label>
                            <p className="text-xs text-muted-foreground pointer-events-none">
                              {customizePerPlatform
                                ? "Her platform için özel metin yazabilirsiniz"
                                : "Tüm platformlar için ortak metin kullanılacak"}
                            </p>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={customizePerPlatform}
                              onCheckedChange={(checked) => {
                                setCustomizePerPlatform(checked);
                                // When switching to per-platform, pre-fill all tabs with base caption
                                if (checked && baseCaption && selectedPlatforms.length > 0) {
                                  const newPlatformCaptions: Record<string, string> = {};
                                  selectedPlatforms.forEach(({ platformId }) => {
                                    // Only pre-fill if platform caption is empty
                                    if (!platformCaptions[platformId]) {
                                      newPlatformCaptions[platformId] = baseCaption;
                                    }
                                  });
                                  if (Object.keys(newPlatformCaptions).length > 0) {
                                    setPlatformCaptions((prev) => ({
                                      ...prev,
                                      ...newPlatformCaptions,
                                    }));
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>

                    {customizePerPlatform && selectedContentType && (selectedContentType as string) !== "story" ? (
                      // Platform-specific tabs
                      selectedPlatforms.length > 0 ? (
                        <Tabs defaultValue={selectedPlatforms[0]?.platformId} className="w-full">
                          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${selectedPlatforms.length}, minmax(0, 1fr))` }}>
                            {selectedPlatforms.map(({ platformId, accounts }) => {
                              const account = accounts[0];
                              const platformInfo = account
                                ? PLATFORM_INFO[account.platform]
                                : null;
                              return (
                                <TabsTrigger key={platformId} value={platformId} className="flex items-center gap-2">
                                  {account && (
                                    <SocialPlatformIcon platform={account.platform} size={16} />
                                  )}
                                  <span className="truncate">
                                    {platformInfo?.shortName || platformId}
                                  </span>
                                </TabsTrigger>
                              );
                            })}
                          </TabsList>
                          {selectedPlatforms.map(({ platformId, accounts }) => {
                            const account = accounts[0];
                            const platformInfo = account
                              ? PLATFORM_INFO[account.platform]
                              : null;
                            const platformTypeLabel = platformId && selectedContentType
                              ? getPlatformTypeLabel(selectedContentType, platformId)
                              : null;
                            
                            const formatPlatformTypeLabel = (label: string | null): string => {
                              if (!label) return "";
                              return label
                                .split("_")
                                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(" ");
                            };

                            return (
                              <TabsContent key={platformId} value={platformId} className="mt-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`caption-${platformId}`}>
                                      {platformInfo?.shortName || platformId} Metni
                                    </Label>
                                    {platformTypeLabel && (
                                      <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal">
                                        {formatPlatformTypeLabel(platformTypeLabel)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Textarea
                                      id={`caption-${platformId}`}
                                      rows={5}
                                      placeholder={`${platformInfo?.shortName || platformId} için metin yazın...`}
                                      value={platformCaptions[platformId] || ""}
                                      onChange={(e) => {
                                        setPlatformCaptions((prev) => ({
                                          ...prev,
                                          [platformId]: e.target.value,
                                        }));
                                      }}
                                    />
                                    <CaptionEditorExtensions
                                      value={platformCaptions[platformId] || ""}
                                      onEmojiSelect={(emoji) => {
                                        const currentValue = platformCaptions[platformId] || "";
                                        const textarea = document.getElementById(`caption-${platformId}`) as HTMLTextAreaElement;
                                        if (textarea) {
                                          const start = textarea.selectionStart;
                                          const end = textarea.selectionEnd;
                                          const newValue =
                                            currentValue.substring(0, start) +
                                            emoji +
                                            currentValue.substring(end);
                                          setPlatformCaptions((prev) => ({
                                            ...prev,
                                            [platformId]: newValue,
                                          }));
                                          // Restore cursor position
                                          setTimeout(() => {
                                            textarea.focus();
                                            textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                          }, 0);
                                        }
                                      }}
                                    />
                                  </div>
                                  {accounts.length > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                      Bu metin {accounts.length} hesap için kullanılacak
                                    </p>
                                  )}
                                </div>
                              </TabsContent>
                            );
                          })}
                        </Tabs>
                      ) : (
                        <div className="rounded-xl border border-dashed p-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            Platform özelleştirmesi için önce hesap seçin
                          </p>
                        </div>
                      )
                    ) : (
                      // Base caption (common for all platforms) - Hidden for story content type
                      selectedContentType && (selectedContentType as string) !== "story" && (
                        <div className="space-y-2">
                          <Label htmlFor="caption">Base caption</Label>
                          <div className="space-y-2">
                            <Textarea
                              id="caption"
                              rows={5}
                              placeholder="Write the main caption that will be adapted per platform..."
                              value={baseCaption}
                              onChange={(e) => setBaseCaption(e.target.value)}
                            />
                            <CaptionEditorExtensions
                              value={baseCaption}
                              onEmojiSelect={(emoji) => {
                                const textarea = document.getElementById("caption") as HTMLTextAreaElement;
                                if (textarea) {
                                  const start = textarea.selectionStart;
                                  const end = textarea.selectionEnd;
                                  const newValue =
                                    baseCaption.substring(0, start) +
                                    emoji +
                                    baseCaption.substring(end);
                                  setBaseCaption(newValue);
                                  // Restore cursor position
                                  setTimeout(() => {
                                    textarea.focus();
                                    textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                                  }, 0);
                                }
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Platform-specific variations can be handled later; this is the
                            base copy.
                          </p>
                        </div>
                      )
                    )}
                    </div>
                  )}

                  {/* Scheduling Box */}
                  <div className="space-y-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setScheduleForLater(!scheduleForLater)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setScheduleForLater(!scheduleForLater);
                        }
                      }}
                      className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent/50 hover:border-primary/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 flex-1">
                          <p className="text-sm font-medium pointer-events-none">Schedule for later</p>
                          <p className="text-xs text-muted-foreground pointer-events-none">
                            If disabled, content will be prepared for immediate
                            publishing.
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={scheduleForLater}
                            onCheckedChange={setScheduleForLater}
                          />
                        </div>
                      </div>
                    </div>
                    {scheduleForLater && (
                      <div className="grid grid-cols-2 gap-3 rounded-xl border p-4">
                        <div className="space-y-2">
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time">Time</Label>
                          <Input
                            id="time"
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Internal Tags / Notes */}
                  <div className="space-y-2">
                    <TagsInput.Root
                      value={internalTags}
                      onValueChange={setInternalTags}
                      className="space-y-2"
                    >
                      <TagsInput.Label asChild>
                        <Label htmlFor="tags">Internal tags / notes</Label>
                      </TagsInput.Label>
                      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 min-h-[2.5rem]">
                        {internalTags.map((tag, index) => (
                          <TagsInput.Item
                            key={index}
                            value={tag}
                            className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground"
                          >
                            <TagsInput.ItemText />
                            <TagsInput.ItemDelete className="ml-0.5 flex h-3 w-3 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <X className="h-2.5 w-2.5" />
                            </TagsInput.ItemDelete>
                          </TagsInput.Item>
                        ))}
                        <TagsInput.Input
                          id="tags"
                          placeholder="summer-2026, launch, brand-awareness..."
                          className="flex-1 border-0 bg-transparent outline-none placeholder:text-muted-foreground min-w-[120px]"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Used only inside the studio for filtering and reporting.
                      </p>
                    </TagsInput.Root>
                  </div>
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="flex-1 overflow-hidden m-0">
                <div className="h-full space-y-6 overflow-y-auto px-6 py-6">
                  {/* Upload Area */}
                  <div className="space-y-3">
                    <Label>Upload media</Label>
                    <input
                      type="file"
                      id="media-upload"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files)}
                    />
                    <label
                      htmlFor="media-upload"
                      className="block rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/30 cursor-pointer"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Drop files here or click to upload
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Supports images (JPG, PNG, GIF) and videos (MP4, MOV)
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById("media-upload")?.click();
                          }}
                        >
                          Browse files
                        </Button>
                      </div>
                    </label>
                  </div>

                  {/* Media Library Quick Access */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Or choose from library</Label>
                      <Button variant="link" size="sm" className="h-auto p-0">
                        Open media library
                      </Button>
                    </div>
                    
                    {/* Placeholder for media library grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <MediaPlaceholder icon={ImagePlus} label="Images" />
                      <MediaPlaceholder icon={Film} label="Videos" />
                      <MediaPlaceholder icon={ImagesIcon} label="Recent" />
                    </div>
                  </div>

                  {/* Selected Media Preview */}
                  <div className="space-y-3">
                    <Label>Selected media</Label>
                    {selectedMedia.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No media selected yet. Upload or choose from library above.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {selectedMedia.map((media, index) => {
                          const isVideo = media.file.type.startsWith("video/");
                          return (
                            <div
                              key={index}
                              className="group relative rounded-lg border overflow-hidden"
                            >
                              {isVideo ? (
                                <video
                                  src={media.previewUrl}
                                  className="w-full h-32 object-cover"
                                  controls={false}
                                />
                              ) : (
                                <img
                                  src={media.previewUrl}
                                  alt={media.file.name}
                                  className="w-full h-32 object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                              <button
                                type="button"
                                onClick={() => handleRemoveMedia(media)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <div className="rounded-full bg-destructive text-destructive-foreground p-1">
                                  <X className="h-4 w-4" />
                                </div>
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                <p className="text-xs text-white truncate">
                                  {media.file.name}
                                </p>
                                <p className="text-xs text-white/80">
                                  {(media.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        {/* Handle */}
        <ResizableHandle withHandle />

        {/* Right Panel - Preview Placeholder */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="border-b px-6 py-4">
              <h2 className="text-sm font-medium">Preview</h2>
              <p className="text-xs text-muted-foreground">
                Platform-specific preview will be rendered here.
              </p>
            </div>

            <div className="flex-1 p-6">
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Preview area (TODO) — connect this with the content preview UI
                later.
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ContentTypeCardProps {
  type: (typeof CONTENT_TYPES)[number];
  selected: boolean;
  onSelect: () => void;
}

function ContentTypeCard({ type, selected, onSelect }: ContentTypeCardProps) {
  const Icon = type.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:bg-accent/50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="h-3 w-3" />
        </div>
      )}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{type.name}</p>
        <p className="text-xs text-muted-foreground">{type.description}</p>
      </div>
    </button>
  );
}


interface MediaPlaceholderProps {
  icon: React.ElementType;
  label: string;
}

function MediaPlaceholder({ icon: Icon, label }: MediaPlaceholderProps) {
  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
    >
      <Icon className="h-6 w-6 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
