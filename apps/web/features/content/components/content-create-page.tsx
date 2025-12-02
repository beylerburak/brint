"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  PreviewLinkCard,
  PreviewLinkCardTrigger,
  PreviewLinkCardContent,
} from "@/components/animate-ui/components/radix/preview-link-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, AlertTriangle, GripVertical, Save } from "lucide-react";
import { useStudioPageHeader } from "@/features/studio/context";
import { useStudioBrand } from "@/features/studio/hooks";
import { useSocialAccounts } from "@/features/social-account/hooks";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useSidebar } from "@/components/animate-ui/components/radix/sidebar";
import { presignUpload, finalizeUpload, getMediaConfig, type MediaConfig } from "@/shared/api/media";
import { createInstagramPublication, createFacebookPublication, createDraftInstagramPublication, createDraftFacebookPublication } from "@/shared/api/publication";
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
  ChevronDown,
  Calendar,
  ChevronRight,
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
import { ContentPreview } from "@/components/generic/content-preview";

// Platform display order constant
const PLATFORM_ORDER: PlatformId[] = ["instagram", "facebook", "tiktok", "x", "youtube", "linkedin", "pinterest"];

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
 * Helper function to get dynamic accordion title based on platform and content type
 */
const getAccordionTitle = (platform: SocialPlatform, contentType: AppContentType): string => {
  const platformInfo = PLATFORM_INFO[platform];
  const platformName = platformInfo?.shortName || platform;

  // Map content types to platform-specific display names
  const contentTypeLabels: Record<AppContentType, string> = {
    single_post: "Post",
    carousel: "Carousel",
    vertical_video: "Reel",
    story: "Story"
  };

  const contentLabel = contentTypeLabels[contentType] || contentType;

  return `${platformName} ${contentLabel}`;
};

/**
 * Content Create Page Layout
 *
 * A resizable two-panel layout for creating new content:
 * - Left panel (60%): Content settings form with tabs
 * - Right panel (40%): Preview placeholder
 */
interface SelectedMedia {
  id: string; // Unique ID for each media item
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
  const [isSchedulePopoverOpen, setIsSchedulePopoverOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<"select" | "datetime">("select");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    scheduledDate ? new Date(scheduledDate) : undefined
  );
  const [internalTags, setInternalTags] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [mediaConfig, setMediaConfig] = useState<MediaConfig | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [draggedMediaIndex, setDraggedMediaIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Store blob URLs separately to prevent them from being lost during drag operations
  const blobUrlsRef = React.useRef<Map<string, string>>(new Map());

  // Separate state for preview media to prevent unnecessary re-renders
  const [previewMedia, setPreviewMedia] = useState<Array<{url: string, type: "image" | "video"}>>([]);

  // Update preview media when selectedMedia changes
  React.useEffect(() => {
    const newPreviewMedia = selectedMedia.map((media) => {
      const preservedUrl = blobUrlsRef.current.get(media.id) || media.previewUrl;
      console.log('Updating preview media - ID:', media.id, 'URL:', preservedUrl);
      return {
        url: preservedUrl,
        type: media.file.type.startsWith("video/") ? "video" as const : "image" as const,
      };
    });
    setPreviewMedia(newPreviewMedia);
  }, [selectedMedia]);

  // Router for navigation
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Sidebar collapse on mount - always start collapsed
  const sidebar = useSidebar();
  const hasCollapsedOnMount = useRef(false);
  const hasInitializedDate = useRef(false);
  
  useEffect(() => {
    if (!hasCollapsedOnMount.current && sidebar) {
      hasCollapsedOnMount.current = true;
      // Force collapse sidebar on mount
      if (sidebar.open) {
        sidebar.setOpen(false);
      }
    }
  }, [sidebar]);

  // Pre-fill schedule date from URL query param (e.g., from calendar day click)
  useEffect(() => {
    if (!hasInitializedDate.current) {
      const dateParam = searchParams.get("date");
      if (dateParam) {
        hasInitializedDate.current = true;
        // Set the schedule date and enable schedule mode
        setScheduledDate(dateParam);
        setSelectedDate(new Date(dateParam));
        setScheduledTime("10:00"); // Default time
        setScheduleForLater(true);
      }
    }
  }, [searchParams]);

  // Cancel always goes back in history
  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  // Function to navigate back to the referring page (after successful publish)
  const navigateBackToReferrer = useCallback(() => {
    const referrer = document.referrer;

    // Check if coming from calendar page
    if (referrer.includes('/calendar')) {
      router.push(`/${workspace?.slug}/studio/${brand?.slug}/calendar`);
      return;
    }

    // Check if coming from content list page
    if (referrer.includes('/contents') || referrer.includes('/studio/') && referrer.includes('/contents')) {
      router.push(`/${workspace?.slug}/studio/${brand?.slug}/contents`);
      return;
    }

    // Default: go to content list
    router.push(`/${workspace?.slug}/studio/${brand?.slug}/contents`);
  }, [router, workspace?.slug, brand?.slug]);
  const [isPublishing, setIsPublishing] = useState(false);
  // Format selected date and time for display
  const formattedScheduleText = useMemo(() => {
    if (scheduledDate && scheduledTime) {
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      return dateTime.toLocaleString('tr-TR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return 'Schedule';
  }, [scheduledDate, scheduledTime]);

  // Fetch social accounts for this brand
  const { accounts } = useSocialAccounts({
    brandId: brand?.id,
    status: "ACTIVE",
  });

  // =========================
  // VALIDATION LOGIC
  // =========================
  
  // Check if selected media has video
  const hasVideoMedia = useMemo(() => {
    return selectedMedia.some((m) => m.file.type.startsWith("video/"));
  }, [selectedMedia]);

  // Check if any selected account is Instagram
  const hasInstagramSelected = useMemo(() => {
    return Array.from(selectedAccounts).some((accountId) => {
      const account = accounts.find((a) => a.id === accountId);
      return account?.platform === "INSTAGRAM_BUSINESS" || account?.platform === "INSTAGRAM_BASIC";
    });
  }, [selectedAccounts, accounts]);

  // Check if any selected account is TikTok
  const hasTikTokSelected = useMemo(() => {
    return Array.from(selectedAccounts).some((accountId) => {
      const account = accounts.find((a) => a.id === accountId);
      return account?.platform === "TIKTOK_BUSINESS";
    });
  }, [selectedAccounts, accounts]);

  // Validation rules
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    // Rule 1: At least one account must be selected
    if (selectedAccounts.size === 0) {
      errors.push("En az bir hesap seçmelisiniz.");
    }

    // Rule 2: Reel/Short content type requires video media
    if (selectedContentType === "vertical_video" && !hasVideoMedia) {
      errors.push("Reel/Short için video yüklemelisiniz.");
    }

    // Rule 3: Single post with Instagram or TikTok requires media
    if (selectedContentType === "single_post" && (hasInstagramSelected || hasTikTokSelected) && selectedMedia.length === 0) {
      errors.push("Instagram veya TikTok için tek gönderi medya gerektirir.");
    }

    // Rule 4: Single post + Instagram = only image (no video)
    if (selectedContentType === "single_post" && hasInstagramSelected && hasVideoMedia) {
      errors.push("Instagram tek gönderisi için sadece resim desteklenir.");
    }

    // Rule 5: Only carousel and story allow multiple media
    if (selectedContentType && selectedContentType !== "carousel" && selectedContentType !== "story" && selectedMedia.length > 1) {
      errors.push("Bu içerik tipi için sadece 1 medya seçebilirsiniz.");
    }

    return errors;
  }, [selectedAccounts, selectedContentType, selectedMedia, hasVideoMedia, hasInstagramSelected, hasTikTokSelected]);

  // Is publish allowed?
  const canPublish = validationErrors.length === 0 && selectedContentType !== null;

  // Load media config
  useEffect(() => {
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

      // Generate unique ID for this media item
      const mediaId = `${file.name}-${file.lastModified}-${Math.random().toString(36).substr(2, 9)}`;

      // Store blob URL in ref to prevent loss during drag operations
      blobUrlsRef.current.set(mediaId, previewUrl);
      console.log('Created blob URL for', mediaId, previewUrl);

      newMedia.push({
        id: mediaId,
        file,
        previewUrl,
      });
    }

    if (newMedia.length > 0) {
      setSelectedMedia((prev) => [...prev, ...newMedia]);
    }
  };

  // Handle drag and drop for file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  // Handle media reordering via drag and drop
  const handleMediaDragStart = (index: number) => {
    setDraggedMediaIndex(index);
  };

  const handleMediaDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedMediaIndex === null || draggedMediaIndex === index) {
      setDragOverIndex(null);
      return;
    }
    setDragOverIndex(index);
  };

  const handleMediaDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedMediaIndex === null || draggedMediaIndex === targetIndex) {
      setDraggedMediaIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder media array without losing blob URLs
    setSelectedMedia((prev) => {
      const newMedia = [...prev];
      const draggedItem = newMedia[draggedMediaIndex];

      // Remove dragged item
      newMedia.splice(draggedMediaIndex, 1);

      // Insert at target position with preserved blob URL
      const preservedUrl = blobUrlsRef.current.get(draggedItem.id) || draggedItem.previewUrl;
      console.log('Drag drop - dragged item ID:', draggedItem.id, 'preserved URL:', preservedUrl);
      const preservedItem = {
        ...draggedItem,
        previewUrl: preservedUrl
      };
      newMedia.splice(targetIndex, 0, preservedItem);

      return newMedia;
    });
    setDraggedMediaIndex(null);
    setDragOverIndex(null);
  };

  const handleMediaDragEnd = () => {
    setDraggedMediaIndex(null);
    setDragOverIndex(null);
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
    // Remove from blob URLs ref
    blobUrlsRef.current.delete(mediaItem.id);
    setSelectedMedia((prev) => prev.filter((item) => item !== mediaItem));
  };

  // Cleanup blob URLs on unmount only
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => {
      // Revoke all blob URLs from the ref on unmount
      blobUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      blobUrls.clear();
    };
  }, []); // Empty dependency - only cleanup on unmount

  // Filter accounts based on selected content type and sort by platform order
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    if (selectedContentType) {
      filtered = accounts.filter((account) => {
        const platformId = mapSocialPlatformToPlatformId(account.platform);
        if (!platformId) return false;

        return isPlatformSupported(selectedContentType, platformId, {
          includeDegraded: true,
        });
      });
    }

    // Sort by platform order: INSTAGRAM, FACEBOOK, TIKTOK, X, YOUTUBE, LINKEDIN, PINTEREST
    return filtered.sort((a, b) => {
      const platformA = mapSocialPlatformToPlatformId(a.platform);
      const platformB = mapSocialPlatformToPlatformId(b.platform);
      const indexA = platformA ? PLATFORM_ORDER.indexOf(platformA) : 999;
      const indexB = platformB ? PLATFORM_ORDER.indexOf(platformB) : 999;
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [accounts, selectedContentType]);

  // Handle draft save
  const handleSaveDraft = useCallback(async () => {
    if (!workspaceReady || !workspace?.id || !brand?.id) {
      toast({
        title: "Hata",
        description: "Çalışma alanı ve marka hazır olmalı",
        variant: "destructive",
      });
      return;
    }

    if (!selectedContentType) {
      toast({
        title: "Hata",
        description: "Lütfen bir içerik tipi seçin",
        variant: "destructive",
      });
      return;
    }

    if (selectedAccounts.size === 0) {
      toast({
        title: "Hata",
        description: "En az bir hesap seçmelisiniz",
        variant: "destructive",
      });
      return;
    }

    setIsSavingDraft(true);

    try {
      // Upload all media first - show uploading state
      setIsUploadingMedia(true);
      const mediaIds: string[] = [];
      for (const mediaItem of selectedMedia) {
        const mediaId = await handleMediaUpload(mediaItem);
        if (mediaId) {
          mediaIds.push(mediaId);
        }
      }
      setIsUploadingMedia(false);

      if (selectedMedia.length > 0 && mediaIds.length === 0) {
        toast({
          title: "Hata",
          description: "Medya yüklenemedi",
          variant: "destructive",
        });
        setIsSavingDraft(false);
        return;
      }

      // Filter only Instagram and Facebook accounts
      // Get selected accounts directly from filteredAccounts and selectedAccounts
      const selectedAccountsArray = filteredAccounts.filter((account) =>
        selectedAccounts.has(account.id)
      );
      const publishableAccounts = selectedAccountsArray.filter(
        (account) =>
          account.platform === "INSTAGRAM_BUSINESS" ||
          account.platform === "INSTAGRAM_BASIC" ||
          account.platform === "FACEBOOK_PAGE"
      );

      if (publishableAccounts.length === 0) {
        toast({
          title: "Hata",
          description: "Sadece Instagram ve Facebook hesapları destekleniyor",
          variant: "destructive",
        });
        setIsSavingDraft(false);
        return;
      }

      // Get caption (platform-specific or base)
      const getCaption = (account: typeof publishableAccounts[0]): string => {
        const platformId = mapSocialPlatformToPlatformId(account.platform);
        if (platformId && customizePerPlatform && platformCaptions[platformId]) {
          return platformCaptions[platformId];
        }
        return baseCaption;
      };

      // Create draft publications for each account (no publishAt, no job queue)
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
                const firstMedia = selectedMedia[0];
                const isVideo = firstMedia?.file.type.startsWith("video/");
                payload.storyType = isVideo ? "VIDEO" : "IMAGE";
                if (isVideo) {
                  payload.videoMediaId = mediaIds[0];
                } else {
                  payload.imageMediaId = mediaIds[0];
                }
              } else {
                payload.imageMediaId = mediaIds[0];
              }
            }

            const draftPayload = {
              socialAccountId: account.id,
              payload,
            };
            console.log("📝 Creating draft Instagram publication:", draftPayload);
            return createDraftInstagramPublication(brand.id, draftPayload);
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
                payload.items = mediaIds.map((mediaId) => {
                  const mediaItem = selectedMedia.find((m) => m.mediaId === mediaId);
                  const isVideo = mediaItem?.file.type.startsWith("video/");
                  return {
                    mediaId,
                    type: isVideo ? "VIDEO" : "IMAGE",
                  };
                });
              } else {
                payload.imageMediaId = mediaIds[0];
              }
            }

            const draftPayload = {
              socialAccountId: account.id,
              payload,
            };
            console.log("📝 Creating draft Facebook publication:", draftPayload);
            return createDraftFacebookPublication(brand.id, draftPayload);
          }
        })
      );

      // Check results
      const successful = publications.filter((p) => p.status === "fulfilled").length;
      const failed = publications.filter((p) => p.status === "rejected").length;

      if (successful > 0) {
        toast({
          title: "Taslak kaydedildi",
          description: `${successful} hesap için taslak kaydedildi${failed > 0 ? ` (${failed} hesap için başarısız)` : ""}`,
        });

        // Navigate back to the referring page after a short delay
        setTimeout(() => {
          navigateBackToReferrer();
        }, 1500);
      } else {
        toast({
          title: "Hata",
          description: "Hiçbir hesap için taslak kaydedilemedi",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Draft save error:", error);
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Taslak kaydedilemedi",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
      setIsUploadingMedia(false);
    }
  }, [
    workspaceReady,
    workspace?.id,
    brand?.id,
    selectedContentType,
    selectedAccounts,
    filteredAccounts,
    selectedMedia,
    customizePerPlatform,
    platformCaptions,
    baseCaption,
    handleMediaUpload,
    toast,
    navigateBackToReferrer,
  ]);

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
    // Get selected accounts directly from filteredAccounts and selectedAccounts
    const selectedAccountsArray = filteredAccounts.filter((account) =>
      selectedAccounts.has(account.id)
    );
    const publishableAccounts = selectedAccountsArray.filter(
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
      // Upload all media first - show uploading state
      setIsUploadingMedia(true);
      const mediaIds: string[] = [];
      for (const mediaItem of selectedMedia) {
        const mediaId = await handleMediaUpload(mediaItem);
        if (mediaId) {
          mediaIds.push(mediaId);
        }
      }
      setIsUploadingMedia(false);

      if (selectedMedia.length > 0 && mediaIds.length === 0) {
        toast({
          title: "Hata",
          description: "Medya yüklenemedi",
          variant: "destructive",
        });
        setIsPublishing(false);
        return;
      }

      // Calculate publishAt (if scheduled)
      // Use scheduledDate and scheduledTime directly instead of scheduleForLater state
      // because state updates are async and might not be ready when handlePublish is called
      let publishAt: string | undefined;
      if (scheduledDate && scheduledTime) {
        const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (!isNaN(dateTime.getTime())) {
          // Only set publishAt if the date is in the future
          const now = new Date();
          if (dateTime > now) {
            publishAt = dateTime.toISOString();
            console.log("📅 Scheduling publication for:", publishAt);
          } else {
            console.warn("⚠️ Scheduled date is in the past, publishing immediately");
          }
        } else {
          console.warn("⚠️ Invalid date/time combination:", scheduledDate, scheduledTime);
        }
      } else {
        console.log("📤 Publishing immediately (no schedule)");
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

            const publicationPayload = {
              socialAccountId: account.id,
              publishAt,
              payload,
            };
            console.log("📤 Creating Instagram publication:", {
              socialAccountId: account.id,
              publishAt: publishAt || "immediate",
              contentType: payload.contentType,
            });
            return createInstagramPublication(brand.id, publicationPayload);
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

            const publicationPayload = {
              socialAccountId: account.id,
              publishAt,
              payload,
            };
            console.log("📤 Creating Facebook publication:", {
              socialAccountId: account.id,
              publishAt: publishAt || "immediate",
              contentType: payload.contentType,
            });
            return createFacebookPublication(brand.id, publicationPayload);
          }
        })
      );

      // Check results
      const successful = publications.filter((p) => p.status === "fulfilled").length;
      const failed = publications.filter((p) => p.status === "rejected").length;

      if (successful > 0) {
        // Different message for scheduled vs immediate publish
        const isScheduled = scheduleForLater && scheduledDate && scheduledTime;
        toast({
          title: isScheduled ? "Planlandı" : "İşleme alındı",
          description: isScheduled 
            ? `İçerik paylaşılmak üzere plana alındı.${failed > 0 ? ` (${failed} hesap için başarısız)` : ""}`
            : `${successful} hesap için yayınlama işlemi başlatıldı${failed > 0 ? ` (${failed} hesap için başarısız)` : ""}`,
        });

        // Navigate back to the referring page after a short delay
        setTimeout(() => {
          navigateBackToReferrer();
        }, 2000);
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
        title: "Hata",
        description: error instanceof Error ? error.message : "Yayınlama başarısız",
        variant: "destructive",
      });
      // DON'T reset schedule date/time on error - user should be able to retry
    } finally {
      setIsPublishing(false);
      // Only reset if successful - schedule date/time should persist on error
      // The navigateBackToReferrer will handle cleanup for successful publishes
      setIsSchedulePopoverOpen(false);
    }
  }, [
    workspaceReady,
    workspace?.id,
    brand?.id,
    selectedContentType,
    selectedAccounts,
    filteredAccounts,
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

  // Handle publish now / schedule
  const handlePublishNow = useCallback(() => {
    if (scheduledDate && scheduledTime) {
      // Schedule mode - validate date and time
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(dateTime.getTime())) {
        toast({
          title: "Hata",
          description: "Geçersiz tarih veya saat seçildi",
          variant: "destructive",
        });
        return;
      }

      const now = new Date();
      if (dateTime <= now) {
        toast({
          title: "Hata",
          description: "Planlanan zaman gelecekte olmalıdır",
          variant: "destructive",
        });
        return;
      }

      // Set scheduleForLater for toast message display
      setScheduleForLater(true);
    } else {
      // Publish now mode - clear schedule state
      setScheduleForLater(false);
    }
    handlePublish();
  }, [scheduledDate, scheduledTime, handlePublish, toast]);


  // Set page header config (after handlePublish is defined)
  // Must include handlePublish in deps - it changes when selectedContentType/accounts change
  const headerConfig = useMemo(
    () => ({
      title: "New Content",
      description:
        "Create a new content and prepare it for publishing across your social accounts.",
      actions: (
        <div className="flex items-center gap-3">
          <Button 
            variant="link" 
            size="sm" 
            className="text-muted-foreground"
            onClick={handleCancel}
          >
            İptal
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSavingDraft ? "Kaydediliyor..." : "Taslak Kaydet"}
          </Button>
          <ButtonGroup>
            <Popover open={isSchedulePopoverOpen} onOpenChange={setIsSchedulePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPublishing || isUploadingMedia}
                >
                  {formattedScheduleText}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Tarih Seçin</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        İçeriğin ne zaman yayınlanacağını seçin
                      </p>
                    </div>

                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) {
                          setScheduledDate(date.toISOString().split('T')[0]);
                          // Auto-set time to 10:00 if not already set
                          if (!scheduledTime) {
                            setScheduledTime("10:00");
                          }
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      className="rounded-md border"
                    />

                    <div className="space-y-2">
                      <Label htmlFor="schedule-time">Saat</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {scheduledDate && scheduledTime && (
                      <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 rounded px-3 py-2">
                        <span>📅</span>
                        <span>
                          {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('tr-TR', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} tarihinde yayınlanacak
                        </span>
                      </div>
                    )}


                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Clear schedule when cancelled
                          setScheduledDate("");
                          setScheduledTime("");
                          setSelectedDate(undefined);
                          setIsSchedulePopoverOpen(false);
                        }}
                        className="flex-1"
                      >
                        Temizle
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setIsSchedulePopoverOpen(false)}
                        className="flex-1"
                      >
                        Tamam
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              onClick={handlePublishNow}
              disabled={isPublishing || isUploadingMedia || !canPublish}
              title={!canPublish ? validationErrors.join("\n") : undefined}
            >
              {isPublishing || isUploadingMedia 
                ? (isUploadingMedia ? "Medya yükleniyor..." : "Yayınlanıyor...") 
                : (scheduledDate && scheduledTime ? "Planla" : "Şimdi Yayınla")}
            </Button>
          </ButtonGroup>
        </div>
      ),
    }),
    [isPublishing, isUploadingMedia, handlePublish, handlePublishNow, handleCancel, handleSaveDraft, isSavingDraft, isSchedulePopoverOpen, selectedDate, scheduledDate, scheduledTime, formattedScheduleText, canPublish, validationErrors]
  );

  useStudioPageHeader(headerConfig);

  return (
    <div className="flex h-full flex-col">
      {/* Main Area - Fixed split */}
      <div className="flex-1 flex">
        {/* Left Panel - Content Settings */}
        <div className="flex-1 flex flex-col border-r">
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

                  {/* Account Selection - Avatar List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select which accounts to publish to</Label>
                      {filteredAccounts.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1 text-xs"
                          onClick={() => {
                            if (selectedAccountsList.length === filteredAccounts.length) {
                              setSelectedAccounts(new Set());
                            } else {
                              setSelectedAccounts(
                                new Set(filteredAccounts.map((a) => a.id))
                              );
                            }
                          }}
                        >
                          {selectedAccountsList.length === filteredAccounts.length
                            ? "Deselect all"
                            : "Select all"}
                        </Button>
                      )}
                    </div>
                    {filteredAccounts.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No accounts available
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-nowrap gap-2 overflow-x-auto">
                        {filteredAccounts.map((account) => {
                          const platformId = mapSocialPlatformToPlatformId(account.platform);
                          const mapping = platformId && selectedContentType
                            ? getPlatformMapping(selectedContentType, platformId)
                            : null;
                          const isSelected = selectedAccounts.has(account.id);

                          // Get account initials for fallback
                          const getAccountInitials = (acc: typeof account): string => {
                            if (acc.displayName) {
                              return acc.displayName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2);
                            }
                            if (acc.username) {
                              return acc.username.slice(0, 2).toUpperCase();
                            }
                            return "AC";
                          };

                          const platformInfo = PLATFORM_INFO[account.platform];

                          const avatarElement = (
                            <div
                              className={cn(
                                "relative rounded-full border-2 cursor-pointer transition-all",
                                isSelected 
                                  ? "border-primary ring-2 ring-primary/20" 
                                  : "border-background hover:border-primary/50"
                              )}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleAccount(account.id);
                              }}
                            >
                              <Avatar className="h-10 w-10">
                                {account.avatarUrl && (
                                  <AvatarImage
                                    src={account.avatarUrl}
                                    alt={account.displayName || account.username || "Account"}
                                  />
                                )}
                                <AvatarFallback>
                                  {getAccountInitials(account)}
                                </AvatarFallback>
                              </Avatar>
                              {/* Platform icon at bottom right of avatar */}
                              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-background border-2 border-background flex items-center justify-center">
                                <SocialPlatformIcon
                                  platform={account.platform}
                                  size={16}
                                  className="opacity-100"
                                />
                              </div>
                              {/* Selection check icon */}
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-background">
                                  <CheckIcon className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          );

                          return (
                            <PreviewLinkCard key={account.id}>
                              <PreviewLinkCardTrigger
                                href={account.profileUrl || undefined}
                                className="no-underline hover:no-underline inline-block"
                              >
                                {avatarElement}
                              </PreviewLinkCardTrigger>
                              <PreviewLinkCardContent>
                                {/* Profile header with avatar */}
                                <div className="flex items-center gap-3 p-4 border-b">
                                  <Avatar className="h-12 w-12 shrink-0">
                                    {account.avatarUrl && (
                                      <AvatarImage
                                        src={account.avatarUrl}
                                        alt={account.displayName || account.username || ""}
                                      />
                                    )}
                                    <AvatarFallback className="bg-muted text-sm">
                                      {getAccountInitials(account)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold truncate">
                                      {account.displayName || account.username || "Unknown"}
                                    </span>
                                    {account.username && (
                                      <span className="text-sm text-muted-foreground truncate">
                                        @{account.username}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Platform info */}
                                <div className="p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <SocialPlatformIcon platform={account.platform} size={20} />
                                    <span className="text-sm text-muted-foreground">
                                      {platformInfo?.name || account.platform}
                                    </span>
                                  </div>
                                  {account.profileUrl && (
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                {/* Mapping notes if available */}
                                {mapping?.notes && (
                                  <div className="px-3 pb-3">
                                    <p className="text-xs text-muted-foreground">{mapping.notes}</p>
                                  </div>
                                )}
                              </PreviewLinkCardContent>
                            </PreviewLinkCard>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Media Selection */}
                  <div className="space-y-3">
                    {/* Story Alert for Multiple Media */}
                    {selectedContentType === "story" && selectedMedia.length > 1 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Story içerik tipinde birden fazla medya yüklediniz. Her medya ayrı bir story olarak yayınlanacaktır.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Upload Area - Shows upload zone when empty, shows media grid when has media */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Medya</Label>
                        {selectedMedia.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("media-upload")?.click()}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Daha fazla ekle
                          </Button>
                        )}
                      </div>
                      <input
                        type="file"
                        id="media-upload"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                      
                      {selectedMedia.length === 0 ? (
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
                                Dosyaları buraya sürükleyin veya tıklayın
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Resim (JPG, PNG, GIF) ve video (MP4, MOV) desteklenir
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
                              Dosya seç
                            </Button>
                          </div>
                        </label>
                      ) : (
                        <div
                          className="flex flex-wrap gap-2"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          {selectedMedia.map((media, index) => {
                            const isVideo = media.file.type.startsWith("video/");

                            // Calculate visual position during drag
                            let visualIndex = index;
                            if (draggedMediaIndex !== null && dragOverIndex !== null && draggedMediaIndex !== dragOverIndex) {
                              if (draggedMediaIndex < dragOverIndex) {
                                // Dragging right
                                if (index > draggedMediaIndex && index <= dragOverIndex) {
                                  visualIndex = index - 1;
                                }
                              } else {
                                // Dragging left
                                if (index < draggedMediaIndex && index >= dragOverIndex) {
                                  visualIndex = index + 1;
                                }
                              }
                            }

                            return (
                              <div
                                key={media.id} // More stable key
                                draggable
                                onDragStart={() => handleMediaDragStart(index)}
                                onDragOver={(e) => handleMediaDragOver(e, index)}
                                onDrop={(e) => handleMediaDrop(e, index)}
                                onDragEnd={handleMediaDragEnd}
                                className={cn(
                                  "group relative rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing w-24 aspect-square transition-transform duration-200",
                                  draggedMediaIndex === index && "opacity-50 ring-2 ring-primary scale-105 z-10",
                                  dragOverIndex === index && draggedMediaIndex !== null && "ring-2 ring-blue-500"
                                )}
                                style={{
                                  order: visualIndex
                                }}
                              >
                                {/* Drag Handle */}
                                <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="rounded bg-black/50 p-1">
                                    <GripVertical className="h-4 w-4 text-white" />
                                  </div>
                                </div>
                                {/* Order Badge */}
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                                  <div className="rounded-full bg-black/50 text-white text-xs font-medium px-2 py-0.5">
                                    {index + 1}
                                  </div>
                                </div>
                                {isVideo ? (
                                  <video
                                    src={media.previewUrl}
                                    className="w-full h-full object-cover"
                                    controls={false}
                                  />
                                ) : (
                                  <img
                                    src={media.previewUrl}
                                    alt={media.file.name}
                                    className="w-full h-full object-cover"
                                    onError={() => console.log('Image failed to load:', media.previewUrl, 'for media ID:', media.id)}
                                  />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedia(media)}
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                  <div className="rounded-full bg-destructive text-destructive-foreground p-1">
                                    <X className="h-4 w-4" />
                                  </div>
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pointer-events-none">
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
                          {/* Add more media placeholder */}
                          <label
                            htmlFor="media-upload"
                            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed w-24 aspect-square text-center transition-colors hover:border-primary/50 hover:bg-accent/30 cursor-pointer"
                            style={{
                              order: selectedMedia.length
                            }}
                          >
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Daha ekle</span>
                          </label>
                        </div>
                      )}
                      
                      {selectedMedia.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          💡 Sırayı değiştirmek için medyaları sürükleyip bırakın
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Content Details */}
                  {selectedContentType && (selectedContentType as string) !== "story" && (
                    <>
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

                      {customizePerPlatform ? (
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
                        // Base caption (common for all platforms)
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
                      )}
                    </>
                  )}

                  {/* Scheduling Box - Commented out, moved to header button group */}
                  {/* <div className="space-y-3">
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
                  </div> */}
                  
                  {/* Schedule Date/Time - Show when scheduleForLater is true */}
                  {scheduleForLater && (
                    <div className="space-y-3">
                      <Label>Schedule Date & Time</Label>
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
                    </div>
                  )}

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
        </div>

        {/* Right Panel - Preview (Fixed width) */}
        <div className="w-[400px] flex flex-col border-l bg-muted/30 shrink-0">
          <div className="flex-1 p-6 overflow-y-auto">
              {selectedAccountsList.length > 0 && selectedContentType ? (
                <Accordion type="multiple" defaultValue={selectedPlatforms.map(({ platformId }) => platformId)} className="space-y-4">
                  {selectedPlatforms.map(({ platformId, accounts }) => {
                    const account = accounts[0];
                    if (!account) return null;

                    // Get caption for this platform
                    const getCaption = (): string => {
                      if (customizePerPlatform && platformCaptions[platformId]) {
                        return platformCaptions[platformId];
                      }
                      return baseCaption;
                    };

                    // Use the stable previewMedia state

                    // Get platform info
                    const platformInfo = PLATFORM_INFO[account.platform];
                    const platformName = platformInfo?.name || platformId;

                    return (
                      <AccordionItem key={platformId} value={platformId} className="border-none">
                        <AccordionTrigger className="px-0 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <SocialPlatformIcon platform={account.platform} size={20} />
                            <span className="font-semibold text-sm">
                              {getAccordionTitle(account.platform, selectedContentType)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 flex justify-center">
                          <div className="w-full max-w-[320px]">
                            <ContentPreview
                              platform={platformId}
                              socialAccount={{
                                displayName: account.displayName,
                                username: account.username,
                                avatarUrl: account.avatarUrl,
                                platform: account.platform,
                                isVerified: false, // TODO: Add verified status to account
                              }}
                              contentType={selectedContentType}
                              caption={getCaption()}
                              media={previewMedia}
                              maxWidth={320}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                  
                  {selectedPlatforms.length === 0 && (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                      Select accounts to see preview
                    </div>
                  )}
                </Accordion>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  {!selectedContentType && "Select content type to see preview"}
                  {selectedContentType && selectedAccountsList.length === 0 && "Select accounts to see preview"}
                </div>
              )}
          </div>
        </div>
      </div>
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
