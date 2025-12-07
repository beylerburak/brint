"use client"

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { IconTrash, IconEdit, IconSend } from "@tabler/icons-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { CommentInput } from "./CommentInput"
import type { TaskCommentsProps, CommentItem } from "./types"
import { BaseTask } from "../types"

export function TaskComments({
    task,
    workspaceId,
    comments,
    onCommentsUpdate,
    onTaskUpdate,
}: TaskCommentsProps) {
    const t = useTranslations("tasks")
    const [newCommentBody, setNewCommentBody] = useState("")
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [editCommentBody, setEditCommentBody] = useState("")
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    const taskId = task?.id


    // Get current user ID
    useEffect(() => {
        async function fetchCurrentUser() {
            try {
                const meResponse = await apiClient.getMe()
                if (meResponse?.user?.id) {
                    setCurrentUserId(meResponse.user.id)
                }
            } catch (error) {
                console.error("Failed to fetch current user:", error)
            }
        }
        fetchCurrentUser()
    }, [])

    if (!taskId) {
        return null
    }

    const handleAddComment = async () => {
        if (!newCommentBody.trim()) {
            return
        }

        const commentBody = newCommentBody.trim()
        setNewCommentBody("") // Clear input immediately for better UX

        try {
            const response = await apiClient.createTaskComment(workspaceId, String(taskId), {
                body: commentBody,
            })

            if (response?.comment) {
                // Get avatar URL from avatarMediaId if available
                let avatarUrl: string | null = null
                if (response.comment.author?.avatarMediaId) {
                    avatarUrl = apiClient.getMediaUrl(workspaceId, response.comment.author.avatarMediaId, 'thumbnail')
                } else if (response.comment.author?.avatarUrl) {
                    avatarUrl = response.comment.author.avatarUrl
                }

                const newComment: CommentItem = {
                    id: response.comment.id,
                    body: response.comment.body,
                    authorUserId: response.comment.author.id,
                    parentId: null,
                    isEdited: false,
                    createdAt: response.comment.createdAt,
                    updatedAt: response.comment.createdAt,
                    author: {
                        id: response.comment.author.id,
                        name: response.comment.author.name,
                        email: response.comment.author.email,
                        avatarUrl,
                        avatarMediaId: response.comment.author.avatarMediaId || null,
                    },
                }
                onCommentsUpdate([...comments, newComment])
            }
        } catch (error: any) {
            console.error("Failed to add comment:", error)
            toast.error(error?.message || t("comments.addError"))
            setNewCommentBody(commentBody) // Restore comment on error
        }
    }

    const handleEditComment = async (commentId: string) => {
        if (!editCommentBody.trim()) {
            setEditingCommentId(null)
            setEditCommentBody("")
            return
        }

        try {
            // Use task-specific comment API for update
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tasks/${taskId}/comments/${commentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Workspace-Id': workspaceId,
                },
                credentials: 'include',
                body: JSON.stringify({
                    body: editCommentBody.trim(),
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error?.message || 'Failed to update comment')
            }

            const data = await response.json()
            if (data?.comment) {
                const updatedComments = comments.map((c) =>
                    c.id === commentId
                        ? {
                            ...c,
                            body: data.comment.body,
                            isEdited: true,
                            updatedAt: data.comment.updatedAt,
                        }
                        : c
                )
                onCommentsUpdate(updatedComments)
                setEditingCommentId(null)
                setEditCommentBody("")
                toast.success(t("comments.updateSuccess"))
            }
        } catch (error: any) {
            console.error("Failed to update comment:", error)
            toast.error(error?.message || t("comments.updateError"))
        }
    }

    const handleDeleteComment = async (commentId: string) => {
        try {
            // Use task-specific comment API for delete
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/tasks/${taskId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'X-Workspace-Id': workspaceId,
                },
                credentials: 'include',
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error?.message || 'Failed to delete comment')
            }

            const updatedComments = comments.filter((c) => c.id !== commentId)
            onCommentsUpdate(updatedComments)
            toast.success(t("comments.deleteSuccess"))
        } catch (error: any) {
            console.error("Failed to delete comment:", error)
            toast.error(error?.message || t("comments.deleteError"))
        }
    }

    const startEdit = (comment: CommentItem) => {
        setEditingCommentId(comment.id)
        setEditCommentBody(comment.body)
    }

    const cancelEdit = () => {
        setEditingCommentId(null)
        setEditCommentBody("")
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return t("comments.time.justNow")
        if (diffMins < 60) return t("comments.time.minutesAgo", { count: diffMins })
        if (diffHours < 24) return t("comments.time.hoursAgo", { count: diffHours })
        if (diffDays < 7) return t("comments.time.daysAgo", { count: diffDays })
        return date.toLocaleDateString()
    }

    return (
        <div className="flex flex-col gap-2 h-full flex-1 min-h-0">
            {/* Comments List */}
            <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overflow-x-visible">
                {comments.length === 0 && (
                    <div className="text-sm text-muted-foreground py-2 px-2 text-center">
                        {t("comments.noComments")}
                    </div>
                )}
                {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors group items-start">
                        {/* Avatar */}
                        <Avatar className="h-8 w-8 mt-0.5">
                            {(() => {
                                // Get avatar URL - either from avatarUrl or from avatarMediaId
                                let avatarUrl = comment.author.avatarUrl

                                // If no avatarUrl but we have avatarMediaId, generate URL
                                if (!avatarUrl && comment.author.avatarMediaId) {
                                    avatarUrl = apiClient.getMediaUrl(workspaceId, comment.author.avatarMediaId, 'thumbnail')
                                }

                                const initials = (comment.author.name || comment.author.email || "U")
                                    .substring(0, 2)
                                    .toUpperCase()

                                return (
                                    <>
                                        {avatarUrl && (
                                            <AvatarImage
                                                src={avatarUrl}
                                                alt={comment.author.name || comment.author.email}
                                            />
                                        )}
                                        <AvatarFallback className="text-[10px] font-semibold">
                                            {initials}
                                        </AvatarFallback>
                                    </>
                                )
                            })()}
                        </Avatar>

                        {/* Comment Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">
                                    {comment.author.name || comment.author.email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(comment.createdAt)}
                                </span>
                                {comment.isEdited && (
                                    <span className="text-xs text-muted-foreground">{t("comments.edited")}</span>
                                )}
                            </div>

                            {editingCommentId === comment.id ? (
                                <div className="flex flex-col gap-2">
                                    <Textarea
                                        value={editCommentBody}
                                        onChange={(e) => setEditCommentBody(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                e.preventDefault()
                                                handleEditComment(comment.id)
                                            } else if (e.key === "Escape") {
                                                cancelEdit()
                                            }
                                        }}
                                        className="text-sm min-h-[60px] resize-none"
                                        autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => handleEditComment(comment.id)}
                                        >
                                            <IconSend className="h-3 w-3" />
                                            {t("comments.save")}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={cancelEdit}
                                        >
                                            {t("comments.cancel")}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                                    {comment.body}
                                </div>
                            )}
                        </div>

                        {/* Actions - Right side */}
                        {editingCommentId !== comment.id && (
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                {comment.authorUserId === currentUserId && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => startEdit(comment)}
                                        >
                                            <IconEdit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteComment(comment.id)}
                                        >
                                            <IconTrash className="h-3.5 w-3.5" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Always visible comment input - always at bottom */}
            <div className="flex-shrink-0 pt-2 pl-0 pr-0 pb-6 overflow-visible">
                <CommentInput
                    value={newCommentBody}
                    onChange={setNewCommentBody}
                    onSubmit={handleAddComment}
                    placeholder={t("comments.addCommentPlaceholder")}
                />
            </div>
        </div>
    )
}

