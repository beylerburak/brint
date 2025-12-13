"use client"

import React, { useState, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { IconCheck, IconGripVertical, IconTrash } from "@tabler/icons-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import type { SortableChecklistItemProps } from "./types"

export function SortableChecklistItem({
    item,
    task,
    workspaceId,
    checklistItems,
    onUpdate,
    onDelete,
}: SortableChecklistItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id })

    const [isEditing, setIsEditing] = useState(false)
    const [editedTitle, setEditedTitle] = useState(item.title)

    useEffect(() => {
        setEditedTitle(item.title)
    }, [item.title])

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    const handleSave = async () => {
        if (!task) return

        if (editedTitle.trim() === item.title.trim()) {
            setIsEditing(false)
            return
        }

        if (!editedTitle.trim()) {
            setEditedTitle(item.title)
            setIsEditing(false)
            return
        }

        try {
            const updatedItems = checklistItems.map((i) =>
                i.id === item.id ? { ...i, title: editedTitle.trim() } : i
            )
            onUpdate(updatedItems)

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                checklistItems: updatedItems.map((i) => ({
                    id: i.id,
                    title: i.title,
                    isCompleted: i.isCompleted,
                    sortOrder: i.sortOrder,
                })),
            })

            if (response?.task?.checklistItems) {
                onUpdate(response.task.checklistItems)
            }

            setIsEditing(false)
        } catch (error: any) {
            console.error("Failed to update checklist item title:", error)
            setEditedTitle(item.title)
            setIsEditing(false)
            toast.error(error?.message || "Failed to update checklist item")
        }
    }

    const handleToggle = async () => {
        if (!task) return

        try {
            const updatedItems = checklistItems.map((i) =>
                i.id === item.id ? { ...i, isCompleted: !i.isCompleted } : i
            )
            onUpdate(updatedItems)

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                checklistItems: updatedItems.map((i) => ({
                    id: i.id,
                    title: i.title,
                    isCompleted: i.isCompleted,
                    sortOrder: i.sortOrder,
                })),
            })

            if (response?.task?.checklistItems) {
                onUpdate(response.task.checklistItems)
            }
        } catch (error: any) {
            console.error("Failed to update checklist item:", error)
            toast.error(error?.message || "Failed to update checklist item")
        }
    }

    const handleDelete = async () => {
        if (!task) return

        try {
            const updatedItems = checklistItems.filter((i) => i.id !== item.id)
            onUpdate(updatedItems)

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                checklistItems: updatedItems.map((i) => ({
                    id: i.id,
                    title: i.title,
                    isCompleted: i.isCompleted,
                    sortOrder: i.sortOrder,
                })),
            })

            if (response?.task?.checklistItems) {
                onUpdate(response.task.checklistItems)
            }
        } catch (error: any) {
            console.error("Failed to delete checklist item:", error)
            toast.error(error?.message || "Failed to delete checklist item")
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-accent/50 hover:border-border/70 transition-colors group"
        >
            <button
                onClick={handleToggle}
                className="flex-shrink-0"
            >
                {item.isCompleted ? (
                    <div className="h-4 w-4 rounded-md border-2 border-primary bg-primary flex items-center justify-center">
                        <IconCheck className="h-3 w-3 text-primary-foreground" />
                    </div>
                ) : (
                    <div className="h-4 w-4 rounded-md border-2 border-muted-foreground/30" />
                )}
            </button>
            {isEditing ? (
                <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.currentTarget.blur()
                        } else if (e.key === "Escape") {
                            setEditedTitle(item.title)
                            setIsEditing(false)
                        }
                    }}
                    className={`flex-1 text-sm font-medium h-auto py-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 ${item.isCompleted
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                    autoFocus
                />
            ) : (
                <span
                    onClick={() => setIsEditing(true)}
                    className={`flex-1 text-sm font-medium cursor-text ${item.isCompleted
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                >
                    {item.title}
                </span>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDelete}
            >
                <IconTrash className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <button
                {...attributes}
                {...listeners}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            >
                <IconGripVertical className="h-4 w-4" />
            </button>
        </div>
    )
}
