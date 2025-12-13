"use client"

import * as React from "react"
import { AccountUserContent } from "./account-user-content"
import { AccountPreferencesContent } from "./account-preferences-content"
import { WorkspaceGeneralContent } from "./workspace-general-content"
import { WorkspaceMembersContent } from "./workspace-members-content"
import { WorkspaceIntegrationsContent } from "./workspace-integrations-content"

interface SettingsContentProps {
  activeItem: string | null
}

export const SettingsContent = React.memo<SettingsContentProps>(
  ({ activeItem }) => {
    // Render different content based on activeItem
    if (activeItem === 'user') {
      return <AccountUserContent />
    }

    if (activeItem === 'preferences') {
      return <AccountPreferencesContent />
    }

    if (activeItem === 'general') {
      return <WorkspaceGeneralContent />
    }

    if (activeItem === 'members') {
      return <WorkspaceMembersContent />
    }

    if (activeItem === 'integrations') {
      return <WorkspaceIntegrationsContent />
    }

    // Default placeholder for other items
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted/50 aspect-video max-w-3xl rounded-xl"
          />
        ))}
      </div>
    )
  }
)

SettingsContent.displayName = "SettingsContent"
