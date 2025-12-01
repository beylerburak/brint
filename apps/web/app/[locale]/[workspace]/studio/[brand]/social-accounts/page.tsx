"use client";

/**
 * Studio Brand Social Accounts Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/social-accounts
 * 
 * Social account management page for the brand studio.
 * Uses BiDataTable for displaying accounts.
 */

import * as React from "react";
import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { 
  Plus, 
  Unplug, 
  Trash2, 
  RefreshCw,
  Calendar,
  CircleDot,
  Type,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PreviewLinkCard,
  PreviewLinkCardTrigger,
  PreviewLinkCardContent,
} from "@/components/animate-ui/components/radix/preview-link-card";
import { 
  BiDataTable, 
  type BiDataTableColumn,
  type BiDataTableAction,
  formatRelativeTime,
  formatFullDate,
} from "@/components/ui/bi-data-table";
import { useToast } from "@/components/ui/use-toast";
import { useStudioBrand } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { useSocialAccounts, ConnectSocialAccountDialog } from "@/features/social-account";
import { useSocialAccountMutations } from "@/features/social-account/hooks/use-social-account-mutations";
import { SocialPlatformIcon } from "@/features/brand/components/social-platform-icon";
import type { SocialAccount, SocialPlatform, SocialAccountStatus } from "@/features/social-account/types";
import { PLATFORM_INFO, STATUS_INFO } from "@/features/social-account/types";

// ============================================================================
// Helper Functions
// ============================================================================

function getAccountInitials(account: SocialAccount): string {
  const name = account.displayName || account.username || "??";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ============================================================================
// Cell Components
// ============================================================================

function PlatformCell({ platform }: { platform: SocialPlatform }) {
  const info = PLATFORM_INFO[platform];
  return (
    <div className="flex items-center gap-2">
      <SocialPlatformIcon platform={platform} className="h-4 w-4" />
      <span className="text-sm">{info.shortName}</span>
    </div>
  );
}

function AccountCell({ account, brandLogoUrl }: { account: SocialAccount; brandLogoUrl?: string | null }) {
  const platformInfo = PLATFORM_INFO[account.platform];
  
  // Avatar priority: account avatar > brand logo > initials
  const avatarSrc = account.avatarUrl || brandLogoUrl || undefined;

  const content = (
    <div className="flex items-center gap-3 cursor-pointer">
      <Avatar className="h-8 w-8 shrink-0">
        {avatarSrc && (
          <AvatarImage src={avatarSrc} alt={account.displayName || account.username || ""} />
        )}
        <AvatarFallback className="bg-muted text-xs">
          {getAccountInitials(account)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-medium">{account.displayName || account.username || "Unknown"}</span>
        {account.username && account.displayName && (
          <span className="text-sm text-muted-foreground">@{account.username}</span>
        )}
      </div>
    </div>
  );

  return (
    <PreviewLinkCard>
      <PreviewLinkCardTrigger 
        href={account.profileUrl || undefined} 
        className="no-underline hover:no-underline"
      >
        {content}
      </PreviewLinkCardTrigger>
      <PreviewLinkCardContent>
        {/* Profile header with avatar */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Avatar className="h-12 w-12 shrink-0">
            {avatarSrc && (
              <AvatarImage src={avatarSrc} alt={account.displayName || account.username || ""} />
            )}
            <AvatarFallback className="bg-muted text-sm">
              {getAccountInitials(account)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold truncate">{account.displayName || account.username}</span>
            {account.username && (
              <span className="text-sm text-muted-foreground truncate">@{account.username}</span>
            )}
          </div>
        </div>
        {/* Platform info */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SocialPlatformIcon platform={account.platform} size={20} />
            <span className="text-sm text-muted-foreground">{platformInfo.name}</span>
          </div>
          {account.profileUrl && (
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </PreviewLinkCardContent>
    </PreviewLinkCard>
  );
}

function StatusBadge({ status }: { status: SocialAccountStatus }) {
  const info = STATUS_INFO[status];
  
  const getStatusClasses = () => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
      case "DISCONNECTED":
        return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
      case "REMOVED":
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      default:
        return "";
    }
  };

  return (
    <Badge variant="outline" className={`shrink-0 text-xs ${getStatusClasses()}`}>
      {info.label}
    </Badge>
  );
}

function LastSyncedCell({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  if (!lastSyncedAt) {
    return <span className="text-sm text-muted-foreground">Never</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground cursor-help">
            {formatRelativeTime(lastSyncedAt)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatFullDate(lastSyncedAt)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Mobile Card Component
// ============================================================================

function SocialAccountMobileCard({ account, brandLogoUrl }: { account: SocialAccount; brandLogoUrl?: string | null }) {
  const platformInfo = PLATFORM_INFO[account.platform];
  
  // Avatar priority: account avatar > brand logo > initials
  const avatarSrc = account.avatarUrl || brandLogoUrl || undefined;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 bg-card text-left transition-colors hover:bg-accent/50 w-full cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10 shrink-0">
            {avatarSrc && (
              <AvatarImage src={avatarSrc} alt={account.displayName || account.username || ""} />
            )}
            <AvatarFallback className="bg-muted">
              {getAccountInitials(account)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium truncate">{account.displayName || account.username || "Unknown"}</span>
            {account.username && (
              <span className="text-xs text-muted-foreground truncate">@{account.username}</span>
            )}
          </div>
        </div>
        <StatusBadge status={account.status} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <SocialPlatformIcon platform={account.platform} className="h-4 w-4" />
          <span className="text-xs text-muted-foreground">{platformInfo.shortName}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {account.lastSyncedAt ? `Synced ${formatRelativeTime(account.lastSyncedAt)}` : "Never synced"}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function StudioBrandSocialAccountsPage() {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { brand, refreshBrand } = useStudioBrand();
  
  // Connect dialog state
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  
  // Fetch social accounts
  const [showRemoved, setShowRemoved] = useState(false);
  const { accounts, loading, error, refresh, fetchMore, hasMore } = useSocialAccounts({ 
    brandId: brand.id,
    includeRemoved: showRemoved,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Mutations
  const { disconnectSocialAccount: disconnectAccount, deleteSocialAccount: deleteAccount } = useSocialAccountMutations(brand.id, {
    onSuccess: () => {
      refresh();
      refreshBrand();
    },
  });

  // Get unique platforms from accounts for filter options
  const uniquePlatforms = React.useMemo(() => {
    const platforms = new Set<string>();
    accounts.forEach((account) => {
      platforms.add(PLATFORM_INFO[account.platform].shortName);
    });
    return Array.from(platforms).sort();
  }, [accounts]);

  // Get unique statuses from accounts for filter options
  const uniqueStatuses = React.useMemo(() => {
    const statuses = new Set<string>();
    accounts.forEach((account) => {
      statuses.add(STATUS_INFO[account.status].label);
    });
    return Array.from(statuses).sort();
  }, [accounts]);

  // Set page header config with badge
  const headerConfig = useMemo(() => ({
    title: "Social Accounts",
    description: `Connect and manage social media accounts for ${brand.name}`,
    badge: !loading && accounts.length > 0 ? (
      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
        {accounts.length}
      </Badge>
    ) : undefined,
  }), [brand.name, accounts.length, loading]);
  
  useStudioPageHeader(headerConfig);

  // Column definitions
  const columns: BiDataTableColumn<SocialAccount>[] = React.useMemo(() => [
    { 
      id: "platform", 
      label: "Platform", 
      type: "select", 
      icon: <CircleDot className="h-4 w-4" />,
      width: "w-[140px]",
      options: uniquePlatforms,
      accessorFn: (row) => PLATFORM_INFO[row.platform].shortName,
      cell: (row) => <PlatformCell platform={row.platform} />,
    },
    { 
      id: "account", 
      label: "Account", 
      type: "text", 
      icon: <Type className="h-4 w-4" />,
      width: "w-[300px]",
      accessorFn: (row) => row.displayName || row.username || "",
      cell: (row) => <AccountCell account={row} brandLogoUrl={brand.logoUrl} />,
    },
    { 
      id: "status", 
      label: "Status", 
      type: "select", 
      icon: <CircleDot className="h-4 w-4" />, 
      options: uniqueStatuses,
      accessorFn: (row) => STATUS_INFO[row.status].label,
      cell: (row) => <StatusBadge status={row.status} />,
      sortValueFn: (row) => row.status === "ACTIVE" ? 0 : row.status === "DISCONNECTED" ? 1 : 2,
    },
    { 
      id: "lastSynced", 
      label: "Last Synced", 
      type: "date", 
      icon: <Calendar className="h-4 w-4" />,
      accessorFn: (row) => row.lastSyncedAt || "",
      cell: (row) => <LastSyncedCell lastSyncedAt={row.lastSyncedAt} />,
      sortValueFn: (row) => row.lastSyncedAt ? new Date(row.lastSyncedAt).getTime() : 0,
    },
  ], [uniquePlatforms, uniqueStatuses, brand.logoUrl]);

  // Row actions
  const actions: BiDataTableAction<SocialAccount>[] = React.useMemo(() => [
    {
      label: "View Profile",
      icon: <ExternalLink className="mr-2 h-4 w-4" />,
      onClick: (account) => {
        if (account.profileUrl) {
          window.open(account.profileUrl, "_blank");
        }
      },
      disabled: (account) => !account.profileUrl,
    },
    {
      label: "Disconnect",
      icon: <Unplug className="mr-2 h-4 w-4" />,
      onClick: async (account) => {
        try {
          await disconnectAccount(account.id);
          toast({
            title: "Account disconnected",
            description: `${account.displayName || account.username} has been disconnected.`,
          });
        } catch (error) {
          // Error is already handled by the mutation hook
        }
      },
      disabled: (account) => account.status !== "ACTIVE",
    },
    {
      label: "Remove",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: async (account) => {
        try {
          await deleteAccount(account.id);
          toast({
            title: "Account removed",
            description: `${account.displayName || account.username} has been removed.`,
          });
        } catch (error) {
          // Error is already handled by the mutation hook
        }
      },
      destructive: true,
      separator: true,
      disabled: (account) => account.status === "REMOVED",
    },
  ], [disconnectAccount, deleteAccount, toast]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await fetchMore();
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, fetchMore]);

  // Handle connect new account
  const handleConnectAccount = useCallback(() => {
    setConnectDialogOpen(true);
  }, []);
  
  // Handle successful connection
  const handleConnectSuccess = useCallback(() => {
    refresh();
    refreshBrand();
  }, [refresh, refreshBrand]);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px]">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Try again
        </Button>
      </div>
    );
  }

  // Empty state component
  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px] border rounded-lg border-dashed">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Unplug className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">No social accounts connected</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Connect your social media accounts to start publishing content for {brand.name}.
        </p>
      </div>
      <Button onClick={handleConnectAccount}>
        <Plus className="mr-2 h-4 w-4" />
        Connect your first account
      </Button>
    </div>
  );

  // Toolbar right section
  const toolbarRight = (
    <Button onClick={handleConnectAccount}>
      <Plus className="mr-2 h-4 w-4" />
      Connect Account
    </Button>
  );

  return (
    <div className="p-6">
      <BiDataTable
        data={accounts}
        columns={columns}
        getRowId={(account) => account.id}
        actions={actions}
        searchPlaceholder="Search accounts..."
        searchableColumns={["account", "platform"]}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        loadMoreLabel="Load more"
        loadingLabel="Loading..."
        toolbarRight={toolbarRight}
        emptyState={emptyState}
        mobileCard={(account) => <SocialAccountMobileCard account={account} brandLogoUrl={brand.logoUrl} />}
        selectable={false}
        commandMenuExtra={
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm">Show removed</span>
            <Switch
              checked={showRemoved}
              onCheckedChange={setShowRemoved}
            />
          </div>
        }
      />

      {/* Connect Social Account Dialog */}
      <ConnectSocialAccountDialog
        brandId={brand.id}
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onSuccess={handleConnectSuccess}
      />
    </div>
  );
}
