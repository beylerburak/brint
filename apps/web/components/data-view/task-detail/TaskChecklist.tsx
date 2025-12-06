"use client"

import React, { useState } from "react"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconListCheck, IconPlus, IconTrash } from "@tabler/icons-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { SortableChecklistItem } from "./SortableChecklistItem"
import type { TaskChecklistProps } from "./types"

export function TaskChecklist({
    task,
    workspaceId,
    checklistItems,
    onChecklistUpdate,
    onTaskUpdate,
}: TaskChecklistProps) {
    const [newChecklistItemTitle, setNewChecklistItemTitle] = useState("")
    const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (!over || active.id === over.id || !task) {
            return
        }

        const sortedItems = [...checklistItems].sort((a, b) => a.sortOrder - b.sortOrder)
        const oldIndex = sortedItems.findIndex((item) => item.id === active.id)
        const newIndex = sortedItems.findIndex((item) => item.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedItems = arrayMove(sortedItems, oldIndex, newIndex)
            const updatedItems = reorderedItems.map((item, index) => ({
                ...item,
                sortOrder: index,
            }))

            onChecklistUpdate(updatedItems)

            try {
                const response = await apiClient.updateTask(workspaceId, String(task.id), {
                    checklistItems: updatedItems.map((i) => ({
                        id: i.id,
                        title: i.title,
                        isCompleted: i.isCompleted,
                        sortOrder: i.sortOrder,
                    })),
                })

                if (response?.task?.checklistItems) {
                    onChecklistUpdate(response.task.checklistItems)
                }
            } catch (error: any) {
                console.error("Failed to reorder checklist items:", error)
                onChecklistUpdate(task?.checklistItems || [])
                toast.error(error?.message || "Failed to reorder checklist items")
            }
        }
    }

    const handleAddItem = async () => {
        if (!task) {
            setIsAddingChecklistItem(false)
            setNewChecklistItemTitle("")
            return
        }

        if (!newChecklistItemTitle.trim()) {
            setIsAddingChecklistItem(false)
            setNewChecklistItemTitle("")
            return
        }

        try {
            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                checklistItems: [
                    ...checklistItems.map((i) => ({
                        id: i.id,
                        title: i.title,
                        isCompleted: i.isCompleted,
                        sortOrder: i.sortOrder,
                    })),
                    {
                        title: newChecklistItemTitle.trim(),
                        isCompleted: false,
                        sortOrder: checklistItems.length,
                    },
                ],
            })

            if (response?.task?.checklistItems) {
                onChecklistUpdate(response.task.checklistItems)
            } else {
                const newItem = {
                    id: `temp-${Date.now()}`,
                    title: newChecklistItemTitle.trim(),
                    isCompleted: false,
                    sortOrder: checklistItems.length,
                }
                onChecklistUpdate([...checklistItems, newItem])
            }

            setNewChecklistItemTitle("")
            setIsAddingChecklistItem(false)
        } catch (error: any) {
            console.error("Failed to add checklist item:", error)
            onChecklistUpdate(task?.checklistItems || [])
            toast.error(error?.message || "Failed to add checklist item")
            setIsAddingChecklistItem(false)
            setNewChecklistItemTitle("")
        }
    }

    const sortedItems = [...checklistItems].sort((a, b) => a.sortOrder - b.sortOrder)

    return (
        <div className="flex flex-col gap-2 mt-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <IconListCheck className="h-4 w-4" />
                    Checklist
                </h3>
                {!isAddingChecklistItem && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                            setIsAddingChecklistItem(true)
                            setNewChecklistItemTitle("")
                        }}
                    >
                        <IconPlus className="h-3.5 w-3.5" />
                        Add item
                    </Button>
                )}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={sortedItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="flex flex-col gap-2">
                        {sortedItems.map((item) => (
                            <SortableChecklistItem
                                key={item.id}
                                item={item}
                                task={task}
                                workspaceId={workspaceId}
                                checklistItems={checklistItems}
                                onUpdate={onChecklistUpdate}
                                onDelete={(itemId) => {
                                    const updatedItems = checklistItems.filter((i) => i.id !== itemId)
                                    onChecklistUpdate(updatedItems)
                                }}
                                onTaskUpdate={onTaskUpdate}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {isAddingChecklistItem && (
                <div className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-accent/50 hover:border-border/70 transition-colors group">
                    <div className="h-4 w-4 rounded-md border-2 border-muted-foreground/30 flex-shrink-0" />
                    <Input
                        value={newChecklistItemTitle}
                        onChange={(e) => setNewChecklistItemTitle(e.target.value)}
                        onBlur={handleAddItem}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.currentTarget.blur()
                            } else if (e.key === "Escape") {
                                setNewChecklistItemTitle("")
                                setIsAddingChecklistItem(false)
                            }
                        }}
                        placeholder="Add checklist item..."
                        className="flex-1 text-sm font-medium h-auto py-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 text-foreground"
                        autoFocus
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                            setNewChecklistItemTitle("")
                            setIsAddingChecklistItem(false)
                        }}
                    >
                        <IconTrash className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                </div>
            )}
        </div>
    )
}
