"use client";

import { useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useStudioPageHeader } from "@/features/studio/context";
import { useStudioBrand } from "@/features/studio/hooks";
import { useSocialAccounts } from "@/features/social-account/hooks";
import { PLATFORM_INFO, type SocialAccount } from "@/features/social-account/types";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import {
  ImageIcon,
  ImagesIcon,
  VideoIcon,
  CircleDotIcon,
  CheckIcon,
  Upload,
  ImagePlus,
  Film,
} from "lucide-react";
import { cn } from "@/shared/utils";

// Content type definitions
const CONTENT_TYPES = [
  {
    id: "single",
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
    id: "reel",
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
export function ContentCreatePage() {
  const { brand } = useStudioBrand();
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedContentType, setSelectedContentType] = useState<string | null>(null);

  // Fetch social accounts for this brand
  const { accounts, loading: accountsLoading } = useSocialAccounts({
    brandId: brand?.id,
    status: "ACTIVE",
  });

  // Set page header config
  const headerConfig = useMemo(
    () => ({
      title: "New Content",
      description:
        "Create a new content and prepare it for publishing across your social accounts.",
      actions: (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Save draft
          </Button>
          <Button size="sm">Save &amp; continue</Button>
        </div>
      ),
    }),
    []
  );

  useStudioPageHeader(headerConfig);

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

  // Select all accounts
  const selectAllAccounts = () => {
    setSelectedAccounts(new Set(accounts.map((a) => a.id)));
  };

  // Deselect all accounts
  const deselectAllAccounts = () => {
    setSelectedAccounts(new Set());
  };

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
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                </TabsList>
              </div>

              {/* Settings Tab - Only Content Type and Platforms */}
              <TabsContent value="settings" className="flex-1 overflow-hidden m-0">
                <div className="h-full space-y-6 overflow-y-auto px-6 py-6">
                  {/* Content Type - Card Selection */}
                  <div className="space-y-3">
                    <Label>Content type</Label>
                    <div className="grid grid-cols-2 gap-3">
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

                  {/* Platforms - Beautiful Checkbox Cards */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Platforms</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Select which accounts to publish to
                        </p>
                      </div>
                      {accounts.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={selectAllAccounts}
                          >
                            Select all
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={deselectAllAccounts}
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {accountsLoading ? (
                      <div className="grid gap-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
                        ))}
                      </div>
                    ) : accounts.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No social accounts connected.
                        </p>
                        <Button variant="link" size="sm" className="mt-1">
                          Connect accounts in Brand Settings
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {accounts.map((account) => (
                          <SocialAccountCard
                            key={account.id}
                            account={account}
                            selected={selectedAccounts.has(account.id)}
                            onToggle={() => toggleAccount(account.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Content Tab - Title, Caption, Scheduling, Tags */}
              <TabsContent value="content" className="flex-1 overflow-hidden m-0">
                <div className="h-full space-y-6 overflow-y-auto px-6 py-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" placeholder="Summer campaign launch post" />
                  </div>

                  {/* Base Caption */}
                  <div className="space-y-2">
                    <Label htmlFor="caption">Base caption</Label>
                    <Textarea
                      id="caption"
                      rows={5}
                      placeholder="Write the main caption that will be adapted per platform..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Platform-specific variations can be handled later; this is the
                      base copy.
                    </p>
                  </div>

                  {/* Scheduling Box */}
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Schedule for later</p>
                        <p className="text-xs text-muted-foreground">
                          If disabled, content will be prepared for immediate
                          publishing.
                        </p>
                      </div>
                      <Switch />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" type="date" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="time">Time</Label>
                        <Input id="time" type="time" />
                      </div>
                    </div>
                  </div>

                  {/* Internal Tags / Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="tags">Internal tags / notes</Label>
                    <Input
                      id="tags"
                      placeholder="summer-2026, launch, brand-awareness..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Used only inside the studio for filtering and reporting.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="flex-1 overflow-hidden m-0">
                <div className="h-full space-y-6 overflow-y-auto px-6 py-6">
                  {/* Upload Area */}
                  <div className="space-y-3">
                    <Label>Upload media</Label>
                    <div className="rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/30 cursor-pointer">
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
                        <Button variant="outline" size="sm" className="mt-2">
                          Browse files
                        </Button>
                      </div>
                    </div>
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
                    <div className="rounded-xl border border-dashed p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No media selected yet. Upload or choose from library above.
                      </p>
                    </div>
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

interface SocialAccountCardProps {
  account: SocialAccount;
  selected: boolean;
  onToggle: () => void;
}

function SocialAccountCard({ account, selected, onToggle }: SocialAccountCardProps) {
  const platformInfo = PLATFORM_INFO[account.platform];
  
  // Get initials for avatar fallback
  const getInitials = () => {
    const name = account.displayName || account.username || "??";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group relative flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:bg-accent/50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      {/* Checkbox */}
      <div className="flex items-center">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="pointer-events-none"
        />
      </div>

      {/* Avatar with platform badge */}
      <div className="relative">
        <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
          {account.avatarUrl && (
            <AvatarImage src={account.avatarUrl} alt={account.displayName || account.username || ""} />
          )}
          <AvatarFallback className="bg-muted text-sm font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        {/* Platform badge */}
        <div className="absolute -bottom-1 -right-1">
          <SocialPlatformIcon platform={account.platform} size={20} className="rounded-full ring-2 ring-background" />
        </div>
      </div>

      {/* Account info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {account.displayName || account.username || "Unknown Account"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs font-medium"
            style={{ color: platformInfo?.color }}
          >
            {platformInfo?.shortName}
          </span>
          {account.username && (
            <span className="text-xs text-muted-foreground truncate">
              @{account.username}
            </span>
          )}
        </div>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
          <CheckIcon className="h-3.5 w-3.5" />
        </div>
      )}
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
