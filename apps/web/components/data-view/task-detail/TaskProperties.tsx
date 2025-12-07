"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { PropertyItem } from "./PropertyItem"
import type { TaskPropertiesProps } from "./types"

export function TaskProperties({
    currentStatus,
    currentPriority,
    currentDueDate,
    currentAssigneeName,
    workspaceMembers,
    onStatusChange,
    onPriorityChange,
    onDateChange,
    onAssigneeChange,
}: TaskPropertiesProps) {
    const t = useTranslations("tasks")

    return (
        <div className="flex flex-col gap-1 pl-0 md:pl-2">
            <PropertyItem
                label={t("detail.properties.status")}
                value={currentStatus}
                type="status"
                onStatusChange={onStatusChange}
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
