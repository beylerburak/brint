"use client"

import React from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { apiClient } from "@/lib/api-client"
import { BaseTask } from "../types"
import type { ActivityItem } from "./types"

interface TaskActivityFeedProps {
    task: BaseTask | null
    workspaceId: string
    activities: ActivityItem[]
    onActivitiesUpdate: (activities: ActivityItem[]) => void
}

export function TaskActivityFeed({
    task,
    workspaceId,
    activities,
    onActivitiesUpdate,
}: TaskActivityFeedProps) {

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    if (activities.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                No activity yet
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 px-0 overflow-y-auto">
            {activities.map((activity) => {
                // Get actor name and avatar
                const actorName = activity.actor
                    ? (activity.actor.name || activity.actor.email || "Unknown")
                    : (activity.actorLabel || "System")

                let actorAvatarUrl = activity.actor?.avatarUrl || null
                if (!actorAvatarUrl && activity.actor?.avatarMediaId) {
                    actorAvatarUrl = apiClient.getMediaUrl(workspaceId, activity.actor.avatarMediaId, 'thumbnail')
                }

                const initials = actorName.substring(0, 2).toUpperCase()

                return (
                    <div key={activity.id} className="flex gap-3 group pt-2">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage
                                src={actorAvatarUrl || undefined}
                                alt={actorName}
                            />
                            <AvatarFallback className="text-[10px] font-semibold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground break-words">
                                        <span className="font-medium">{actorName}</span>{" "}
                                        {activity.message || activity.eventKey}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDate(activity.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

