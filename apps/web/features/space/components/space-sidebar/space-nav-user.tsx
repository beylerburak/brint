'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/animate-ui/components/radix/dropdown-menu';
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/animate-ui/components/radix/sidebar';
import { useAuth } from '@/features/auth/context/auth-context';
import { apiCache } from '@/shared/api/cache';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { getCurrentSession } from '@/features/auth/api/auth-api';
import { Badge } from '@/components/ui/badge';
import { SpaceSwitcherDropdownContent } from './space-switcher';

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export function SpaceNavUser() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');
  const { logout, user: authUser, loading: authLoading } = useAuth();
  const { workspace } = useWorkspace();
  const [avatarUrl, setAvatarUrl] = React.useState<string | null | undefined>(null);
  const [workspacePlan, setWorkspacePlan] = React.useState<string | null>(null);

  // Get avatarUrl from cache (getCurrentSession populates user:profile cache)
  // Only read from cache, never trigger API calls
  // This prevents re-renders when workspace changes or settings dialog opens
  React.useEffect(() => {
    if (!authUser?.id) {
      setAvatarUrl(null);
      return;
    }

    // Read from cache without triggering fetch
    const cachedProfile = apiCache.get<{
      id: string;
      email: string;
      name: string | null;
      avatarUrl?: string | null;
    }>('user:profile', 30000); // 30 seconds TTL

    setAvatarUrl(cachedProfile?.avatarUrl ?? null);
  }, [authUser?.id]);

  // Get workspace plan from session
  React.useEffect(() => {
    let cancelled = false;

    const loadWorkspacePlan = async () => {
      if (!workspace?.slug) {
        setWorkspacePlan(null);
        return;
      }

      try {
        const session = await getCurrentSession();
        if (cancelled) return;

        if (session) {
          const allWorkspaces = [
            ...(session.ownerWorkspaces ?? []),
            ...(session.memberWorkspaces ?? []),
          ];
          const currentWs = allWorkspaces.find((ws) => ws.slug === workspace.slug);
          const plan = currentWs?.subscription?.plan || 'FREE';
          
          if (!cancelled) {
            setWorkspacePlan(plan);
          }
        } else {
          if (!cancelled) {
            setWorkspacePlan('FREE');
          }
        }
      } catch (error) {
        console.warn('Failed to load workspace plan', error);
        if (!cancelled) {
          setWorkspacePlan('FREE');
        }
      }
    };

    void loadWorkspacePlan();

    return () => {
      cancelled = true;
    };
  }, [workspace?.slug]);

  // Memoize user data to prevent unnecessary re-renders
  // Use auth context user as primary source, enhance with avatarUrl from cache
  const user = React.useMemo(() => {
    if (!authUser) {
      return null;
    }
    return {
      name: authUser.name || null,
      email: authUser.email,
      avatarUrl: avatarUrl,
    };
  }, [authUser?.id, authUser?.name, authUser?.email, avatarUrl]);

  // Memoize logout handler to prevent unnecessary re-renders
  const handleLogout = React.useCallback(async () => {
    await logout();
    const localePrefix = locale === 'en' ? '' : `/${locale}`;
    router.push(`${localePrefix}/login`);
  }, [logout, locale, router]);

  // Show loading state while auth is loading
  if (authLoading || !user) {
    return (
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" disabled>
              <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
              <div className="grid flex-1 text-left text-sm leading-tight gap-1">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    );
  }

  const initials = getInitials(user.name, user.email);
  // Get first word of name, or fallback to email
  const displayName = user.name 
    ? user.name.split(' ')[0] 
    : user.email;
  // Show workspace slug with @ prefix (without suffix, badge will show separately)
  const workspaceSlugDisplay = workspace?.slug ? `@${workspace.slug}` : '';

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={displayName} />
                  )}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  {workspaceSlugDisplay && (
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs">{workspaceSlugDisplay}</span>
                      {workspacePlan && (
                        <Badge variant="outline" className="text-xs h-4 px-1.5">
                          {workspacePlan}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.avatarUrl && (
                      <AvatarImage src={user.avatarUrl} alt={displayName} />
                    )}
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    {workspaceSlugDisplay && (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs">{workspaceSlugDisplay}</span>
                        {workspacePlan && (
                          <Badge variant="outline" className="text-xs h-4 px-1.5">
                            {workspacePlan}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <SpaceSwitcherDropdownContent />
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Sparkles />
                  Upgrade to Pro
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <BadgeCheck />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell />
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut />
                {t('logOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

