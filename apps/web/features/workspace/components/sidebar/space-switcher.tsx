"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronsUpDown, Plus } from "lucide-react";
import { resolveWorkspacePath } from "@/shared/routing/route-resolver";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

function SpaceSwitcherComponent({
  teams,
}: {
  teams: {
    name: string;
    slug: string;
    logo: React.ElementType;
    plan: string;
  }[];
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);
  const t = useTranslations("common");

  React.useEffect(() => {
    if (!teams || teams.length === 0) return;
    const segments = pathname.split("/").filter(Boolean);
    const hasLocalePrefix = segments[0] === locale;
    const currentWorkspaceSlug = hasLocalePrefix ? segments[1] : segments[0];
    const matching = teams.find((team) => team.slug === currentWorkspaceSlug);
    setActiveTeam(matching ?? teams[0]);
  }, [teams, pathname, locale]);

  if (!activeTeam) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <activeTeam.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("spaces")}
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => {
                  setActiveTeam(team);
                  const newPath = resolveWorkspacePath(locale, team.slug, pathname);
                  router.push(newPath);
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-3.5 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">
                {t("addSpace")}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Memoize SpaceSwitcher to prevent re-renders when teams array reference changes but content is the same
export const SpaceSwitcher = React.memo(SpaceSwitcherComponent, (prevProps, nextProps) => {
  // Compare teams arrays by their slugs (teams are identified by slug)
  if (prevProps.teams.length !== nextProps.teams.length) {
    return false; // Re-render if length changed
  }
  
  // Check if all team slugs are the same and in the same order
  const prevSlugs = prevProps.teams.map(t => t.slug).join(',');
  const nextSlugs = nextProps.teams.map(t => t.slug).join(',');
  
  if (prevSlugs !== nextSlugs) {
    return false; // Re-render if slugs changed
  }
  
  // Check if plans changed for any team
  for (let i = 0; i < prevProps.teams.length; i++) {
    if (prevProps.teams[i].plan !== nextProps.teams[i].plan) {
      return false; // Re-render if plan changed
    }
  }
  
  return true; // Don't re-render if content is the same
});
