"use client";

/**
 * Brand Social Accounts Panel
 * 
 * Displays and manages social accounts connected to a brand.
 */

import { useState } from "react";
import {
  Plus,
  Unplug,
  Trash2,
  Link,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useHasPermission } from "@/features/permissions/hooks/hooks";
import {
  useSocialAccounts,
  useSocialAccountMutations,
  type SocialAccount,
  PLATFORM_INFO,
  STATUS_INFO,
} from "@/features/social-account";
import { BrandSocialAccountConnectDialog } from "./brand-social-account-connect-dialog";
import { SocialPlatformIcon } from "./social-platform-icon";

// ============================================================================
// Main Component
// ============================================================================

interface BrandSocialAccountsPanelProps {
  brandId: string;
  onBrandRefresh?: () => void;
}

export function BrandSocialAccountsPanel({
  brandId,
  onBrandRefresh,
}: BrandSocialAccountsPanelProps) {
  // Permissions
  const canView = useHasPermission("studio:social_account.view");
  const canConnect = useHasPermission("studio:social_account.connect");
  const canDisconnect = useHasPermission("studio:social_account.disconnect");
  const canDelete = useHasPermission("studio:social_account.delete");

  // State
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectingAccount, setDisconnectingAccount] = useState<SocialAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<SocialAccount | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  // Data fetching - show ACTIVE + DISCONNECTED by default, include REMOVED if showRemoved is true
  const { accounts, loading, error, refresh } = useSocialAccounts({
    brandId,
    includeRemoved: showRemoved,
  });

  // Mutations with callbacks
  const mutations = useSocialAccountMutations(brandId, {
    onSuccess: refresh,
    onBrandRefresh,
  });

  // Permission check
  if (!canView) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            You don&apos;t have permission to view social accounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return <SocialAccountsSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium text-destructive">Failed to load social accounts</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!disconnectingAccount) return;
    await mutations.disconnectSocialAccount(disconnectingAccount.id);
    setDisconnectingAccount(null);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingAccount) return;
    await mutations.deleteSocialAccount(deletingAccount.id);
    setDeletingAccount(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Social Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Manage social media accounts connected to this brand
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRemoved(!showRemoved)}
          >
            {showRemoved ? "Hide Removed" : "Show Removed"}
          </Button>
          {canConnect && (
            <Button size="sm" onClick={() => setConnectDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Connect Account
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Link className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center mb-4">
              No social accounts connected to this brand.
              {canConnect && " Connect your first social account to get started."}
            </p>
            {canConnect && (
              <Button size="sm" onClick={() => setConnectDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Connect Account
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        // Accounts Table
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <SocialAccountRow
                  key={account.id}
                  account={account}
                  canDisconnect={canDisconnect && account.status === "ACTIVE"}
                  canDelete={canDelete}
                  onDisconnect={() => setDisconnectingAccount(account)}
                  onDelete={() => setDeletingAccount(account)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Connect Dialog */}
      <BrandSocialAccountConnectDialog
        open={connectDialogOpen}
        brandId={brandId}
        onClose={() => setConnectDialogOpen(false)}
        onSuccess={() => {
          setConnectDialogOpen(false);
          refresh();
          onBrandRefresh?.();
        }}
      />

      {/* Disconnect Confirmation */}
      <AlertDialog
        open={!!disconnectingAccount}
        onOpenChange={(open) => !open && setDisconnectingAccount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Social Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect{" "}
              <strong>
                {disconnectingAccount?.displayName || disconnectingAccount?.username}
              </strong>
              ? This will remove the credentials but keep the account record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.disconnectLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={mutations.disconnectLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {mutations.disconnectLoading ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Social Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>
                {deletingAccount?.displayName || deletingAccount?.username}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={mutations.deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutations.deleteLoading ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Table Row
// ============================================================================

interface SocialAccountRowProps {
  account: SocialAccount;
  canDisconnect: boolean;
  canDelete: boolean;
  onDisconnect: () => void;
  onDelete: () => void;
}

function SocialAccountRow({
  account,
  canDisconnect,
  canDelete,
  onDisconnect,
  onDelete,
}: SocialAccountRowProps) {
  const platformInfo = PLATFORM_INFO[account.platform];
  const statusInfo = STATUS_INFO[account.status];

  return (
    <TableRow>
      {/* Platform */}
      <TableCell>
        <div className="flex items-center gap-2">
          <SocialPlatformIcon platform={account.platform} size={20} />
          <span className="text-sm font-medium">{platformInfo?.shortName || account.platform}</span>
        </div>
      </TableCell>

      {/* Account */}
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage 
              src={getAvatarUrl(account)} 
              alt={account.displayName || account.username || "Avatar"} 
            />
            <AvatarFallback className="text-xs bg-muted">
              {getAccountInitials(account)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">
              {account.displayName || account.username || account.externalId}
            </span>
            {account.username && account.displayName && (
              <span className="text-xs text-muted-foreground">@{account.username}</span>
            )}
          </div>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge variant={statusInfo?.variant || "outline"}>{statusInfo?.label || account.status}</Badge>
      </TableCell>

      {/* Last Synced */}
      <TableCell>
        {account.lastSyncedAt ? (
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(account.lastSyncedAt)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Never</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {canDisconnect && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={onDisconnect}
              title="Disconnect"
            >
              <Unplug className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getAccountInitials(account: SocialAccount): string {
  const name = account.displayName || account.username || account.externalId || "";
  const words = name.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "??";
}

/**
 * Get avatar URL with fallback to platform data
 * Priority: avatarUrl (our S3) > platformData pictureUrl (Facebook/Instagram CDN)
 */
function getAvatarUrl(account: SocialAccount): string | undefined {
  if (account.avatarUrl) {
    return account.avatarUrl;
  }
  
  // Fallback to platform-specific picture URLs in platformData
  const platformData = account.platformData as Record<string, unknown> | null;
  if (platformData) {
    // Facebook stores it as pictureUrl
    if (typeof platformData.pictureUrl === 'string') {
      return platformData.pictureUrl;
    }
    // Instagram stores it as profilePictureUrl
    if (typeof platformData.profilePictureUrl === 'string') {
      return platformData.profilePictureUrl;
    }
  }
  
  return undefined;
}

// ============================================================================
// Skeleton
// ============================================================================

function SocialAccountsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Card>
        <div className="p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

