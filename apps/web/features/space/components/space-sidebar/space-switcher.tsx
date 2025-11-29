'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/animate-ui/components/radix/dropdown-menu';
import { useWorkspace } from '@/features/space/context/workspace-context';
import { getCurrentSession } from '@/features/auth/api/auth-api';
import { logger } from '@/shared/utils/logger';

function getSpaceInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function SpaceIcon({ initial }: { initial: string }) {
  return (
    <span className="text-xs font-semibold">{initial}</span>
  );
}

interface SpaceItem {
  id: string;
  slug: string;
  name: string;
  plan?: string;
}

function getSpaceDisplayName(space: { name?: string; slug: string }): string {
  return space.name || space.slug;
}

export function SpaceSwitcherDropdownContent() {
  const router = useRouter();
  const locale = useLocale();
  const { workspace: currentWorkspace } = useWorkspace();
  const [spaces, setSpaces] = React.useState<SpaceItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load spaces from session
  React.useEffect(() => {
    let cancelled = false;

    const loadSpaces = async () => {
      try {
        setLoading(true);
        const session = await getCurrentSession();

        if (cancelled) return;

        if (session) {
          const allWorkspaces = [
            ...(session.ownerWorkspaces ?? []),
            ...(session.memberWorkspaces ?? []),
          ];

          const spacesData = allWorkspaces.map((ws) => ({
            id: ws.id,
            slug: ws.slug,
            name: getSpaceDisplayName(ws),
            plan: ws.subscription?.plan || 'FREE',
          }));

          // Sort by most recently updated
          spacesData.sort((a, b) => {
            const aIndex = allWorkspaces.findIndex((w) => w.id === a.id);
            const bIndex = allWorkspaces.findIndex((w) => w.id === b.id);
            if (aIndex === -1 || bIndex === -1) return 0;
            
            const aTime = new Date(allWorkspaces[aIndex].updatedAt).getTime();
            const bTime = new Date(allWorkspaces[bIndex].updatedAt).getTime();
            return bTime - aTime;
          });

          if (!cancelled) {
            setSpaces(spacesData);
          }
        } else {
          if (!cancelled) {
            setSpaces([]);
          }
        }
      } catch (error) {
        logger.warn('Failed to load spaces', error);
        if (!cancelled) {
          setSpaces([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSpaces();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSpace = React.useMemo(() => {
    if (!currentWorkspace?.slug) return spaces[0] || null;
    return spaces.find((s) => s.slug === currentWorkspace.slug) || spaces[0] || null;
  }, [spaces, currentWorkspace?.slug]);

  const handleSpaceSelect = React.useCallback(
    (space: SpaceItem) => {
      const localePrefix = locale === 'en' ? '' : `/${locale}`;
      router.push(`${localePrefix}/${space.slug}/dashboard`);
    },
    [locale, router]
  );

  const activeInitial = activeSpace ? getSpaceInitial(activeSpace.name) : '?';

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={loading || spaces.length === 0}>
        <div className="flex items-center gap-2">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-5 items-center justify-center rounded-full">
            {loading ? (
              <span className="text-xs">...</span>
            ) : activeSpace ? (
              <SpaceIcon initial={activeInitial} />
            ) : (
              <span className="text-xs">?</span>
            )}
          </div>
          <span className="truncate font-medium">
            {loading ? 'Loading...' : activeSpace?.name || 'No space'}
          </span>
        </div>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64 rounded-lg">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Spaces
        </DropdownMenuLabel>
        {spaces.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No spaces available
          </DropdownMenuItem>
        ) : (
          spaces.map((space, index) => {
            const spaceInitial = getSpaceInitial(space.name);
            return (
              <DropdownMenuItem
                key={space.id}
                onSelect={() => handleSpaceSelect(space)}
                className="gap-2 p-2"
              >
                <div className="rounded-full flex size-6 items-center justify-center border">
                  <SpaceIcon initial={spaceInitial} />
                </div>
                <span className="truncate">{space.name}</span>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2">
          <div className="bg-background flex size-6 items-center justify-center rounded-md border">
            <Plus className="size-4" />
          </div>
          <div className="text-muted-foreground font-medium">Add space</div>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

