"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { ChevronDown, Plus } from "lucide-react"
import { useWorkspace } from "@/contexts/workspace-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function WorkspaceSwitcher() {
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'en'
  const { currentWorkspace, workspaces } = useWorkspace()

  if (!currentWorkspace) {
    return null
  }

  const handleWorkspaceSwitch = (workspaceSlug: string) => {
    router.push(`/${locale}/${workspaceSlug}/home`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto p-1.5 pr-3 data-[state=open]:bg-sidebar-accent"
        >
          <Avatar className="h-6 w-6 rounded-md">
            <AvatarImage src={currentWorkspace.avatarUrl || undefined} alt={currentWorkspace.name} />
            <AvatarFallback className="rounded-md text-xs">
              {currentWorkspace.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="ml-1.5 truncate font-medium text-sm">
            @{currentWorkspace.slug}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 rounded-lg"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleWorkspaceSwitch(workspace.slug)}
            className="gap-2 p-2"
            disabled={workspace.id === currentWorkspace.id}
          >
            <Avatar className="h-6 w-6 rounded-md">
              <AvatarImage src={workspace.avatarUrl || undefined} alt={workspace.name} />
              <AvatarFallback className="rounded-md text-xs">
                {workspace.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">@{workspace.slug}</span>
              <span className="text-xs text-muted-foreground">{workspace.plan}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2" disabled>
          <div className="bg-background flex size-6 items-center justify-center rounded-md border">
            <Plus className="size-4" />
          </div>
          <div className="text-muted-foreground font-medium">Create Workspace</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
