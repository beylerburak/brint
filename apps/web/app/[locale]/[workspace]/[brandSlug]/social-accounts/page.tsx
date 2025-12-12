"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  IconDots, 
  IconPlus,
  IconRefresh,
  IconUnlink,
  IconTrash,
  IconAlertCircle,
  IconCheck,
  IconExternalLink,
  IconSettings,
  IconInfoCircle,
  IconBuildingStore,
} from "@tabler/icons-react"
import { SocialIcon } from "react-social-icons"
import { toast } from "sonner"
import { apiClient, type SocialAccountDto, type SocialPlatform, type SocialAccountStatus } from "@/lib/api-client"
import { useWorkspace } from "@/contexts/workspace-context"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Status, StatusIndicator, StatusLabel } from "@/components/kibo-ui/status"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { canAddSocialAccount, type PlanType } from "@brint/shared-config/plans"
import { UpgradeDialog } from "@/features/workspace/upgrade-dialog"

// ============================================================================
// Platform Configuration
// ============================================================================

type PlatformConfig = {
  name: string;
  network: string;
  color: string;
  bgColor: string;
  connectUrl?: string;
};

const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  INSTAGRAM: {
    name: "Instagram",
    network: "instagram",
    color: "text-pink-500",
    bgColor: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
  },
  FACEBOOK: {
    name: "Facebook",
    network: "facebook",
    color: "text-blue-600",
    bgColor: "bg-blue-600",
  },
  TIKTOK: {
    name: "TikTok",
    network: "tiktok",
    color: "text-black dark:text-white",
    bgColor: "bg-black dark:bg-white",
  },
  LINKEDIN: {
    name: "LinkedIn",
    network: "linkedin",
    color: "text-blue-700",
    bgColor: "bg-blue-700",
  },
  X: {
    name: "X",
    network: "x",
    color: "text-black dark:text-white",
    bgColor: "bg-black dark:bg-white",
  },
  YOUTUBE: {
    name: "YouTube",
    network: "youtube",
    color: "text-red-600",
    bgColor: "bg-red-600",
  },
  WHATSAPP: {
    name: "WhatsApp",
    network: "whatsapp",
    color: "text-green-500",
    bgColor: "bg-green-500",
  },
  PINTEREST: {
    name: "Pinterest",
    network: "pinterest",
    color: "text-red-600",
    bgColor: "bg-red-600",
  },
};

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: SocialAccountStatus }) {
  const variants: Record<SocialAccountStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
    ACTIVE: {
      variant: "default",
      label: "Active",
      icon: <IconCheck className="h-3 w-3 mr-1" />,
    },
    EXPIRED: {
      variant: "destructive",
      label: "Expired",
      icon: <IconAlertCircle className="h-3 w-3 mr-1" />,
    },
    REVOKED: {
      variant: "secondary",
      label: "Disconnected",
      icon: <IconUnlink className="h-3 w-3 mr-1" />,
    },
  };

  const config = variants[status];

  return (
    <Badge variant={config.variant} className="flex items-center">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Social Account Card Component
// ============================================================================

function SocialAccountCard({
  account,
  onDisconnect,
  onDelete,
  onReconnect,
  onTogglePublish,
  canManage,
  brandAvatarUrl,
}: {
  account: SocialAccountDto;
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
  onReconnect: (id: string, platform: SocialPlatform) => void;
  onTogglePublish: (id: string, enabled: boolean) => void;
  canManage: boolean;
  brandAvatarUrl?: string | null;
}) {
  const config = PLATFORM_CONFIG[account.platform];

  // Use account avatar, fallback to brand avatar, then to icon
  // For YouTube, use brand avatar as fallback if external avatar is not available
  let avatarUrl: string | undefined;
  if (account.platform === 'YOUTUBE') {
    // YouTube: account avatar > external avatar > brand logo > undefined (icon fallback)
    avatarUrl = account.avatarUrl || account.externalAvatarUrl || brandAvatarUrl || undefined;
  } else {
    // Other platforms: account avatar > external avatar > brand logo > undefined (icon fallback)
    avatarUrl = account.avatarUrl || account.externalAvatarUrl || brandAvatarUrl || undefined;
  }

  return (
    <Card className="relative shadow-none p-3 sm:p-4 rounded-lg">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Profile Picture with Platform Icon Overlay */}
        <div className="relative flex-shrink-0">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-muted flex items-center justify-center">
              <SocialIcon 
                network={config.network} 
                style={{ height: 40, width: 40 }} 
                className="!h-10 !w-10 sm:!h-12 sm:!w-12"
              />
            </AvatarFallback>
          </Avatar>
          {/* Platform Icon Overlay - bottom right corner */}
          <div className="absolute -bottom-1 -right-1 sm:-bottom-1.5 sm:-right-1.5">
            <SocialIcon 
              network={config.network} 
              style={{ height: 20, width: 20 }} 
              className="!h-5 !w-5 sm:!h-6 sm:!w-6"
            />
          </div>
        </div>

        {/* Account Details */}
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm sm:text-base font-semibold mb-0.5 truncate">
            {account.displayName || config.name}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground truncate">
            {account.username 
              ? (
                  <>
                    {account.platform === 'X' || account.platform === 'YOUTUBE' ? account.username : `@${account.username}`}
                    <span className="text-muted-foreground/70"> • {config.name.toLowerCase()}</span>
                  </>
                )
              : (
                  <>
                    <span className="text-muted-foreground/70">Username not available</span>
                    <span className="text-muted-foreground/70"> • {config.name.toLowerCase()}</span>
                  </>
                )}
          </CardDescription>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Status */}
            {account.status === 'REVOKED' && account.lastErrorMessage ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Status 
                      status="offline"
                    >
                      <StatusIndicator />
                      <StatusLabel>
                        Disconnected
                      </StatusLabel>
                    </Status>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{account.lastErrorMessage}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Status 
                status={
                  account.status === 'ACTIVE' ? 'online' : 
                  account.status === 'EXPIRED' ? 'degraded' : 
                  'offline'
                }
              >
                <StatusIndicator />
                <StatusLabel>
                  {account.status === 'ACTIVE' ? 'Active' : 
                   account.status === 'EXPIRED' ? 'Expired' : 
                   'Disconnected'}
                </StatusLabel>
              </Status>
            )}

          {/* 3 Dots Menu Button */}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                  <IconDots className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(account.status === 'EXPIRED' || account.status === 'REVOKED') && (
                  <DropdownMenuItem onClick={() => onReconnect(account.id, account.platform)}>
                    <IconRefresh className="h-4 w-4 mr-2" />
                    Reconnect
                  </DropdownMenuItem>
                )}
                {account.status === 'ACTIVE' && (
                  <DropdownMenuItem onClick={() => onDisconnect(account.id)}>
                    <IconUnlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(account.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function SocialAccountSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onConnect }: { onConnect?: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="p-4 bg-muted rounded-full mb-4">
          <IconPlus className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No social accounts connected</h3>
        <p className="text-muted-foreground text-center mb-4 max-w-sm">
          {onConnect
            ? "Connect your social media accounts to start publishing content directly from your brand studio."
            : "No social accounts are connected to this brand. Contact an administrator to connect accounts."}
        </p>
        {onConnect && (
          <Button onClick={onConnect}>
            <IconPlus className="h-4 w-4" />
            Connect Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Connect Account Dialog
// ============================================================================

function ConnectAccountDialog({ 
  open, 
  onOpenChange,
  onConnectMeta,
  connectingMeta,
  onConnectLinkedIn,
  connectingLinkedIn,
  onConnectX,
  connectingX,
  onConnectTikTok,
  connectingTikTok,
  onConnectYouTube,
  connectingYouTube,
  onConnectPinterest,
  connectingPinterest,
  accounts,
  workspacePlan,
  onShowUpgrade,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onConnectMeta: () => void;
  connectingMeta: boolean;
  onConnectLinkedIn: () => void;
  connectingLinkedIn: boolean;
  onConnectX: () => void;
  connectingX: boolean;
  onConnectTikTok: () => void;
  connectingTikTok: boolean;
  onConnectYouTube: () => void;
  connectingYouTube: boolean;
  onConnectPinterest: () => void;
  connectingPinterest: boolean;
  accounts: SocialAccountDto[];
  workspacePlan: PlanType;
  onShowUpgrade: () => void;
}) {
  // Check limits for each platform
  const getPlatformAccountCount = (platform: SocialPlatform) => {
    return accounts.filter(acc => acc.platform === platform).length;
  };

  const handlePlatformClick = (platformId: string, platform: SocialPlatform, onClick: () => void) => {
    const currentCount = getPlatformAccountCount(platform);
    if (!canAddSocialAccount(workspacePlan, platform, currentCount)) {
      onShowUpgrade();
      return;
    }
    onClick();
  };

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook Page',
      network: 'facebook',
      bgColor: 'bg-blue-600',
      enabled: true,
      platform: 'FACEBOOK' as SocialPlatform,
      onClick: () => handlePlatformClick('facebook', 'FACEBOOK', onConnectMeta),
      loading: connectingMeta,
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      network: 'linkedin',
      bgColor: 'bg-blue-700',
      enabled: true,
      platform: 'LINKEDIN' as SocialPlatform,
      onClick: () => handlePlatformClick('linkedin', 'LINKEDIN', onConnectLinkedIn),
      loading: connectingLinkedIn,
    },
    {
      id: 'twitter',
      name: 'X',
      network: 'x',
      bgColor: 'bg-black dark:bg-white',
      iconColor: 'text-white dark:text-black',
      enabled: true,
      platform: 'X' as SocialPlatform,
      onClick: () => handlePlatformClick('twitter', 'X', onConnectX),
      loading: connectingX,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      network: 'tiktok',
      bgColor: 'bg-black dark:bg-white',
      iconColor: 'text-white dark:text-black',
      enabled: true,
      platform: 'TIKTOK' as SocialPlatform,
      onClick: () => handlePlatformClick('tiktok', 'TIKTOK', onConnectTikTok),
      loading: connectingTikTok,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      network: 'youtube',
      bgColor: 'bg-red-600',
      enabled: true,
      platform: 'YOUTUBE' as SocialPlatform,
      onClick: () => handlePlatformClick('youtube', 'YOUTUBE', onConnectYouTube),
      loading: connectingYouTube,
    },
    {
      id: 'instagram',
      name: 'Instagram Page',
      network: 'instagram',
      bgColor: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
      enabled: true,
      platform: 'INSTAGRAM' as SocialPlatform,
      onClick: () => handlePlatformClick('instagram', 'INSTAGRAM', onConnectMeta),
      loading: connectingMeta,
    },
    {
      id: 'pinterest',
      name: 'Pinterest',
      network: 'pinterest',
      bgColor: 'bg-red-600',
      enabled: true,
      platform: 'PINTEREST' as SocialPlatform,
      onClick: () => handlePlatformClick('pinterest', 'PINTEREST', onConnectPinterest),
      loading: connectingPinterest,
    },
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Connect Account</AlertDialogTitle>
        </AlertDialogHeader>
        
        <div className="grid grid-cols-3 gap-4 py-4">
          {platforms.map((platform) => {
            const isDisabled = !platform.enabled || platform.loading;
            
            return (
              <button
                key={platform.id}
                onClick={platform.enabled ? platform.onClick : undefined}
                disabled={isDisabled}
                className={`
                  relative p-6 rounded-lg border bg-white dark:bg-gray-900
                  transition-all duration-200
                  ${isDisabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:shadow-md hover:border-primary cursor-pointer'
                  }
                `}
              >
                {/* Plus icon in top right */}
                <div className={`
                  absolute top-3 right-3
                  ${isDisabled ? 'opacity-30' : ''}
                `}>
                  {platform.loading ? (
                    <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <IconPlus className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Platform icon */}
                <div className={`mx-auto mb-4 ${isDisabled ? 'opacity-50' : ''}`}>
                  <SocialIcon 
                    network={platform.network} 
                    style={{ height: 64, width: 64 }} 
                    className="!h-16 !w-16"
                  />
                </div>

                {/* Platform name */}
                <p className={`
                  text-center text-sm font-medium
                  ${isDisabled ? 'text-muted-foreground' : 'text-foreground'}
                `}>
                  {platform.name}
                </p>
              </button>
            );
          })}
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// LinkedIn Selection Dialog
// ============================================================================

type LinkedInAccountOption = {
  isPending?: boolean;
  id: string;
  platformAccountId: string;
  displayName: string | null;
  username: string | null;
  externalAvatarUrl: string | null;
  avatarUrl: string | null;
  canPublish: boolean;
  tokenData: { kind?: 'member' | 'organization' } | null;
  status: SocialAccountStatus;
};

function LinkedInSelectionDialog({
  open,
  onOpenChange,
  brandId,
  workspaceId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  workspaceId: string;
  onSaved: () => void;
}) {
  const [accounts, setAccounts] = useState<LinkedInAccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasPendingToken, setHasPendingToken] = useState(false);

  // Load accounts when dialog opens
  useEffect(() => {
    if (open && brandId && workspaceId) {
      loadAccounts();
    }
  }, [open, brandId, workspaceId]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getLinkedInOptions(workspaceId, brandId);
      setAccounts(response.accounts);
      setHasPendingToken(response.hasPendingToken || false);
      
      // If there's a pending token (new connection), don't pre-select any accounts
      // User must explicitly choose which accounts to import
      if (response.hasPendingToken) {
        setSelectedIds(new Set());
      } else {
        // For existing accounts, initialize with currently active accounts
        const activeIds = new Set(
          response.accounts.filter(acc => acc.canPublish).map(acc => acc.id)
        );
        setSelectedIds(activeIds);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load LinkedIn accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (accountId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedIds(newSelected);
  };

  const handleSave = async () => {
    if (hasPendingToken && selectedIds.size === 0) {
      toast.error('Please select at least one LinkedIn account to continue');
      return;
    }
    
    setSaving(true);
    try {
      await apiClient.saveLinkedInSelection(workspaceId, brandId, Array.from(selectedIds));
      toast.success('LinkedIn account selection saved');
      setHasPendingToken(false); // Clear pending flag after save
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to save LinkedIn selection:', error);
      const errorMessage = error?.message || error?.error?.message || 'Failed to save selection';
      console.error('Error details:', {
        message: errorMessage,
        status: error?.status,
        code: error?.code,
        fullError: error
      });
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Prevent closing dialog if there's a pending token and no selection made
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasPendingToken && selectedIds.size === 0) {
      toast.error('Please select at least one LinkedIn account to continue');
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" onPointerDownOutside={(e) => {
        if (hasPendingToken && selectedIds.size === 0) {
          e.preventDefault();
        }
      }} onEscapeKeyDown={(e) => {
        if (hasPendingToken && selectedIds.size === 0) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle>
            {hasPendingToken || accounts.some(acc => acc.isPending)
              ? 'Import LinkedIn Accounts' 
              : 'Select LinkedIn Accounts'}
          </DialogTitle>
          <DialogDescription>
            {hasPendingToken || accounts.some(acc => acc.isPending)
              ? 'Select which LinkedIn accounts you want to import. You must select at least one account to continue. You can choose your profile and/or organization pages.'
              : 'Choose which LinkedIn accounts you want to use for publishing. You can select your profile and/or organization pages.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No LinkedIn accounts found. Please connect LinkedIn first.</p>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {accounts.map((account) => {
              const isSelected = selectedIds.has(account.id);
              const kind = account.tokenData?.kind || 'member';
              const kindLabel = kind === 'member' ? 'Profile' : 'Organization';
              
              return (
                <div
                  key={account.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                  onClick={() => handleToggle(account.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(account.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={account.avatarUrl || account.externalAvatarUrl || undefined} />
                    <AvatarFallback className="flex items-center justify-center">
                      <SocialIcon 
                        network="linkedin" 
                        style={{ height: 40, width: 40 }} 
                        className="!h-10 !w-10"
                      />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {account.displayName || 'LinkedIn Account'}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {kindLabel}
                      </Badge>
                    </div>
                    {account.username && (
                      <p className="text-xs text-muted-foreground truncate">
                        {account.username}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <IconCheck className="h-5 w-5 text-primary" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {!hasPendingToken && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || loading || (hasPendingToken && selectedIds.size === 0)}>
            {saving ? (
              <>
                <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              hasPendingToken ? 'Continue' : 'Save Selection'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function BrandSocialAccountsPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string
  const locale = params?.locale as string || 'tr'
  const { currentWorkspace } = useWorkspace()
  
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false)
  const [connectingX, setConnectingX] = useState(false)
  const [connectingTikTok, setConnectingTikTok] = useState(false)
  const [connectingYouTube, setConnectingYouTube] = useState(false)
  const [connectingPinterest, setConnectingPinterest] = useState(false)
  const [linkedInSelectionOpen, setLinkedInSelectionOpen] = useState(false)
  const [shouldOpenLinkedInModal, setShouldOpenLinkedInModal] = useState(false)
  const [brandAvatarUrl, setBrandAvatarUrl] = useState<string | null>(null)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)

  // Check if user can connect accounts (OWNER or ADMIN only)
  const canConnectAccounts = currentWorkspace?.userRole === 'OWNER' || currentWorkspace?.userRole === 'ADMIN'

  // Fetch brand ID first
  useEffect(() => {
    async function fetchBrand() {
      if (!currentWorkspace?.id || !brandSlug) return;
      
      try {
        const response = await apiClient.getBrandBySlug({
          workspaceId: currentWorkspace.id,
          slug: brandSlug,
        });
        setBrandId(response.brand.id);
        // Get brand logo URL as fallback avatar
        setBrandAvatarUrl(response.brand.logoUrl || null);
      } catch (err) {
        setError("Failed to load brand");
        setLoading(false);
      }
    }
    
    fetchBrand();
  }, [currentWorkspace?.id, brandSlug]);

  // Fetch social accounts
  const fetchAccounts = useCallback(async () => {
    if (!currentWorkspace?.id || !brandId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.listSocialAccounts(currentWorkspace.id, brandId);
      setAccounts(response.socialAccounts);
    } catch (err) {
      setError("Failed to load social accounts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, brandId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Check for OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    
    if (connected === 'facebook') {
      toast.success('Facebook and Instagram accounts connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh accounts
      fetchAccounts();
    } else if (connected === 'linkedin') {
      // Clean URL immediately to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname);
      // Set flag to open modal once brandId and workspace are ready
      setShouldOpenLinkedInModal(true);
      // Refresh accounts
      fetchAccounts();
    } else if (connected === 'x') {
      toast.success('X account connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh accounts
      fetchAccounts();
    } else if (connected === 'tiktok') {
      toast.success('TikTok account connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh accounts
      fetchAccounts();
    } else if (connected === 'youtube') {
      toast.success('YouTube account connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh accounts
      fetchAccounts();
    } else if (connected === 'pinterest') {
      toast.success('Pinterest account connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh accounts
      fetchAccounts();
    }
  }, [fetchAccounts]);

  // Open LinkedIn modal when brandId and workspace are ready
  useEffect(() => {
    if (shouldOpenLinkedInModal && brandId && currentWorkspace?.id) {
      // Small delay to ensure accounts are loaded
      setTimeout(() => {
        setLinkedInSelectionOpen(true);
        setShouldOpenLinkedInModal(false);
      }, 300);
    }
  }, [shouldOpenLinkedInModal, brandId, currentWorkspace?.id]);

  // Handlers
  const handleDisconnect = async (accountId: string) => {
    if (!currentWorkspace?.id || !brandId) return;
    
    try {
      await apiClient.disconnectSocialAccount(currentWorkspace.id, brandId, accountId);
      toast.success("Account disconnected");
      fetchAccounts();
    } catch (err) {
      toast.error("Failed to disconnect account");
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!currentWorkspace?.id || !brandId) return;
    
    try {
      await apiClient.deleteSocialAccount(currentWorkspace.id, brandId, accountId);
      toast.success("Account deleted");
      setDeleteConfirmId(null);
      fetchAccounts();
    } catch (err) {
      toast.error("Failed to delete account");
    }
  };

  const handleReconnect = (accountId: string, platform: SocialPlatform) => {
    // For X, use the same connect flow
    if (platform === 'X') {
      handleConnectX();
      return;
    }
    // For TikTok, use the same connect flow
    if (platform === 'TIKTOK') {
      handleConnectTikTok();
      return;
    }
    // For YouTube, use the same connect flow
    if (platform === 'YOUTUBE') {
      handleConnectYouTube();
      return;
    }
    // For Pinterest, use the same connect flow
    if (platform === 'PINTEREST') {
      handleConnectPinterest();
      return;
    }
    // For Facebook/Instagram, use the same connect flow
    if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
      handleConnectMeta();
      return;
    }
    // For LinkedIn, reconnect - modal will open automatically after OAuth callback
    if (platform === 'LINKEDIN') {
      handleConnectLinkedIn();
      return;
    }
    toast.info(`Reconnect flow for ${PLATFORM_CONFIG[platform].name} coming soon!`);
  };

  const handleConnectMeta = async () => {
    if (!currentWorkspace?.id || !brandId) {
      toast.error("Workspace or brand not loaded");
      return;
    }

    try {
      setConnectingMeta(true);
      const response = await apiClient.getFacebookAuthorizeUrl(currentWorkspace.id, brandId, locale);
      
      // Redirect to Facebook OAuth
      window.location.href = response.authorizeUrl;
    } catch (err) {
      console.error(err);
      toast.error("Failed to start Facebook connection");
      setConnectingMeta(false);
    }
  };

  const handleConnectLinkedIn = async () => {
    if (!currentWorkspace?.id || !brandId) {
      toast.error("Workspace or brand not loaded");
      return;
    }

    try {
      setConnectingLinkedIn(true);
      const response = await apiClient.getLinkedInAuthorizeUrl(currentWorkspace.id, brandId, locale);
      
      // Redirect to LinkedIn OAuth
      window.location.href = response.authorizeUrl;
    } catch (err) {
      console.error(err);
      toast.error("Failed to start LinkedIn connection");
      setConnectingLinkedIn(false);
    }
  };

  const handleConnectX = async () => {
    if (!currentWorkspace?.id || !brandId) {
      toast.error("Workspace or brand not loaded");
      return;
    }

    try {
      setConnectingX(true);
      const response = await apiClient.getXAuthorizeUrl(currentWorkspace.id, brandId, locale);
      
      // Redirect to X OAuth
      window.location.href = response.authorizeUrl;
    } catch (err) {
      console.error(err);
      toast.error("Failed to start X connection");
      setConnectingX(false);
    }
  };

  const handleConnectTikTok = async () => {
    if (!currentWorkspace?.id || !brandId) {
      toast.error("Workspace or brand not loaded");
      return;
    }

    try {
      setConnectingTikTok(true);
      const response = await apiClient.getTikTokAuthorizeUrl(currentWorkspace.id, brandId, locale);
      
      // Redirect to TikTok OAuth
      window.location.href = response.authorizeUrl;
    } catch (err) {
      console.error(err);
      toast.error("Failed to start TikTok connection");
      setConnectingTikTok(false);
    }
  };

  const handleConnectYouTube = async () => {
    if (!currentWorkspace?.id || !brandId) {
      toast.error("Workspace or brand not loaded");
      return;
    }

    try {
      setConnectingYouTube(true);
      const response = await apiClient.getYouTubeAuthorizeUrl(currentWorkspace.id, brandId, locale);
      
      // Redirect to YouTube OAuth
      window.location.href = response.authorizeUrl;
    } catch (err) {
      console.error(err);
      toast.error("Failed to start YouTube connection");
      setConnectingYouTube(false);
    }
  };

  const handleConnectPinterest = async () => {
    if (!currentWorkspace?.id || !brandId) {
      toast.error("Workspace or brand not loaded");
      return;
    }

    try {
      setConnectingPinterest(true);
      const response = await apiClient.getPinterestAuthorizeUrl(currentWorkspace.id, brandId, locale);
      
      // Redirect to Pinterest OAuth
      window.location.href = response.authorizeUrl;
    } catch (err) {
      console.error(err);
      toast.error("Failed to start Pinterest connection");
      setConnectingPinterest(false);
    }
  };

  const handleLinkedInSelectionSaved = () => {
    fetchAccounts();
    setShouldOpenLinkedInModal(false);
  };

  const handleTogglePublish = async (accountId: string, enabled: boolean) => {
    if (!currentWorkspace?.id || !brandId) return;
    
    try {
      // For LinkedIn, we need to use the selection endpoint
      if (accounts.find(acc => acc.id === accountId)?.platform === 'LINKEDIN') {
        // Get all LinkedIn accounts and update selection
        const linkedInAccounts = accounts.filter(acc => acc.platform === 'LINKEDIN');
        const selectedIds = linkedInAccounts
          .filter(acc => acc.id === accountId ? enabled : acc.canPublish)
          .map(acc => acc.id);
        
        await apiClient.saveLinkedInSelection(currentWorkspace.id, brandId, selectedIds);
      } else {
        // For other platforms, we can directly update (if API supports it)
        // For now, just refresh - you may need to add an API endpoint for this
        toast.info('Publish toggle feature coming soon for this platform');
        return;
      }
      
      toast.success(enabled ? 'Account enabled for publishing' : 'Account disabled for publishing');
      fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update account publishing status');
    }
  };

  return (
    <div className="w-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center px-6 pt-6 pb-0 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="text-2xl font-semibold">Social Accounts</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <IconDots className="h-4 w-4" />
          </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {/* Add menu items here if needed in the future */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Connect Account Button */}
        {canConnectAccounts && (
          <div className="ml-auto">
            <Button onClick={() => setConnectDialogOpen(true)}>
              <IconPlus className="h-4 w-4 mr-2" />
          Connect Account
        </Button>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="px-6 pt-4 pb-6 space-y-6">
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <SocialAccountSkeleton />
          <SocialAccountSkeleton />
          <SocialAccountSkeleton />
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <IconAlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchAccounts}>
                <IconRefresh className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <EmptyState onConnect={canConnectAccounts ? () => setConnectDialogOpen(true) : undefined} />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <SocialAccountCard
              key={account.id}
              account={account}
              onDisconnect={handleDisconnect}
              onDelete={(id) => setDeleteConfirmId(id)}
              onReconnect={handleReconnect}
              onTogglePublish={handleTogglePublish}
              canManage={canConnectAccounts}
              brandAvatarUrl={brandAvatarUrl}
            />
          ))}
        </div>
      )}
      </div>

      {/* Connect Dialog */}
      <ConnectAccountDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnectMeta={handleConnectMeta}
        connectingMeta={connectingMeta}
        onConnectLinkedIn={handleConnectLinkedIn}
        connectingLinkedIn={connectingLinkedIn}
        onConnectX={handleConnectX}
        connectingX={connectingX}
        onConnectTikTok={handleConnectTikTok}
        connectingTikTok={connectingTikTok}
        onConnectYouTube={handleConnectYouTube}
        connectingYouTube={connectingYouTube}
        onConnectPinterest={handleConnectPinterest}
        connectingPinterest={connectingPinterest}
        accounts={accounts}
        workspacePlan={(currentWorkspace?.plan || 'FREE') as PlanType}
        onShowUpgrade={() => setUpgradeDialogOpen(true)}
      />

      {/* Upgrade Dialog */}
      {currentWorkspace && (
        <UpgradeDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          currentPlan={currentWorkspace.plan}
          feature="socialAccounts"
        />
      )}

      {/* LinkedIn Selection Dialog */}
      {brandId && currentWorkspace?.id && (
        <LinkedInSelectionDialog
          open={linkedInSelectionOpen}
          onOpenChange={setLinkedInSelectionOpen}
          brandId={brandId}
          workspaceId={currentWorkspace.id}
          onSaved={handleLinkedInSelectionSaved}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Social Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this social account? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
