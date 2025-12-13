"use client"

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { apiClient } from "@/lib/api-client"
import { PropertyItem } from "./PropertyItem"
import type { TaskPropertiesProps } from "./types"

export function TaskProperties({
    task,
    workspaceId,
    brandId,
    currentStatus,
    currentPriority,
    currentDueDate,
    currentAssigneeName,
    workspaceMembers,
    onStatusChange,
    onPriorityChange,
    onDateChange,
    onAssigneeChange,
    taskStatuses,
}: TaskPropertiesProps) {
    const t = useTranslations("tasks")
    const [availableStatuses, setAvailableStatuses] = useState<Array<{ id: string; label: string; color: string | null; isDefault: boolean; group?: 'TODO' | 'IN_PROGRESS' | 'DONE' }>>([])

    // Use provided taskStatuses or fetch from API
    useEffect(() => {
        async function fetchStatuses() {
            // If taskStatuses prop is provided, use it instead of fetching
            if (taskStatuses) {
                const statusesWithGroup = [
                    ...taskStatuses.TODO.map(s => ({ ...s, group: 'TODO' as const })),
                    ...taskStatuses.IN_PROGRESS.map(s => ({ ...s, group: 'IN_PROGRESS' as const })),
                    ...taskStatuses.DONE.map(s => ({ ...s, group: 'DONE' as const })),
                ]
                setAvailableStatuses(statusesWithGroup)
                return
            }
            
            try {
                const response = await apiClient.listTaskStatuses(workspaceId, brandId)
                // Map statuses with their group information
                const statusesWithGroup = [
                    ...response.statuses.TODO.map(s => ({ ...s, group: 'TODO' as const })),
                    ...response.statuses.IN_PROGRESS.map(s => ({ ...s, group: 'IN_PROGRESS' as const })),
                    ...response.statuses.DONE.map(s => ({ ...s, group: 'DONE' as const })),
                ]
                setAvailableStatuses(statusesWithGroup)
            } catch (error) {
                console.error("Failed to fetch task statuses:", error)
                // Keep empty array, will fall back to AVAILABLE_STATUSES
            }
        }
        if (workspaceId) {
            fetchStatuses()
        }
    }, [workspaceId, brandId, taskStatuses])

    return (
        <div className="flex flex-col gap-1 pl-0 md:pl-2">
            <PropertyItem
                label={t("detail.properties.status")}
                value={currentStatus}
                type="status"
                onStatusChange={onStatusChange}
                availableStatuses={availableStatuses}
            />
            <PropertyItem
                label={t("detail.properties.priority")}
                value={currentPriority}
                type="priority"
                onPriorityChange={onPriorityChange}
            />
            <PropertyItem
                label={t("detail.properties.dueDate")}
                value={currentDueDate || 'null'}
                type="date"
                onDateChange={onDateChange}
            />
            <PropertyItem
                label={t("detail.properties.assignedTo")}
                value={currentAssigneeName || t("detail.unassigned")}
                type="assignee"
                workspaceMembers={workspaceMembers}
                onAssigneeChange={onAssigneeChange}
            />
        </div>
    )
}
