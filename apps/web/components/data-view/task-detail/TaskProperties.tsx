"use client"

import React from "react"
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
    return (
        <div className="flex flex-col gap-1 pl-0 md:pl-2">
            <PropertyItem
                label="Status"
                value={currentStatus}
                type="status"
                onStatusChange={onStatusChange}
            />
            <PropertyItem
                label="Priority"
                value={currentPriority}
                type="priority"
                onPriorityChange={onPriorityChange}
            />
            <PropertyItem
                label="Due Date"
                value={currentDueDate || 'null'}
                type="date"
                onDateChange={onDateChange}
            />
            <PropertyItem
                label="Assigned To"
                value={currentAssigneeName || 'Unassigned'}
                type="assignee"
                workspaceMembers={workspaceMembers}
                onAssigneeChange={onAssigneeChange}
            />
        </div>
    )
}
