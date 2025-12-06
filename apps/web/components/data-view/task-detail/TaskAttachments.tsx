"use client"

import React, { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconPaperclip, IconFile, IconDownload, IconUpload, IconTrash } from "@tabler/icons-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { validateFilesForUpload, ALLOWED_EXTENSIONS } from "@/lib/upload-config"
import type { TaskAttachmentsProps, AttachmentItem, AttachmentDetails } from "./types"

export function TaskAttachments({
    task,
    workspaceId,
    attachments,
    attachmentDetails,
    onAttachmentsUpdate,
    onAttachmentDetailsUpdate,
}: TaskAttachmentsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
    }

    const getFileExtension = (filename: string): string => {
        const parts = filename.split('.')
        return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0 || !task?.id || !workspaceId) return

        // Validate files before upload
        const validationErrors = validateFilesForUpload(files)
        if (validationErrors.length > 0) {
            // Show each error as a toast
            validationErrors.forEach((error) => {
                toast.error(error)
            })
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }

        const currentAttachments = attachments

        try {
            // Optimistically add attachments to UI
            const tempIds = files.map((_, index) => `temp-upload-${Date.now()}-${index}-${Math.random()}`)
            const optimisticAttachments = files.map((file, index) => ({
                id: tempIds[index],
                mediaId: tempIds[index],
                title: file.name,
                sizeBytes: file.size,
            }))
            onAttachmentsUpdate([...currentAttachments, ...optimisticAttachments])

            // Store media details optimistically
            const optimisticDetailsMap = new Map(attachmentDetails)
            files.forEach((file, index) => {
                optimisticDetailsMap.set(tempIds[index], {
                    sizeBytes: file.size,
                    originalFilename: file.name
                })
            })
            onAttachmentDetailsUpdate(optimisticDetailsMap)

            const uploadPromises = files.map((file) => apiClient.uploadMedia(workspaceId, file))
            const uploadResults = await Promise.all(uploadPromises)

            const newMediaIds = uploadResults.map((result) => result.media.id)
            const existingRealMediaIds = currentAttachments.filter((a) => !a.mediaId.startsWith('temp-')).map((a) => a.mediaId)
            const allMediaIds = [...existingRealMediaIds, ...newMediaIds]

            // Create a map with all current details plus new upload results
            const allDetailsMap = new Map(attachmentDetails)
            uploadResults.forEach((result) => {
                allDetailsMap.set(result.media.id, {
                    sizeBytes: result.media.sizeBytes,
                    originalFilename: result.media.originalFilename
                })
            })
            tempIds.forEach((tempId) => {
                allDetailsMap.delete(tempId)
            })

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                attachmentMediaIds: allMediaIds,
            })

            onAttachmentDetailsUpdate(allDetailsMap)

            const existingAttachmentsMap = new Map(
                currentAttachments
                    .filter((a) => !a.mediaId.startsWith('temp-'))
                    .map((a) => [a.mediaId, a])
            )

            const newAttachments = uploadResults.map((result) => ({
                id: result.media.id,
                mediaId: result.media.id,
                title: result.media.originalFilename || null,
                sizeBytes: result.media.sizeBytes,
            }))

            const responseAttachmentMap = new Map(
                (response?.task?.attachments || []).map((att: any) => [att.mediaId, att])
            )

            const currentMediaIds = currentAttachments.filter((a) => !a.mediaId.startsWith('temp-')).map((a) => a.mediaId)
            const allAttachmentMediaIds = new Set([...currentMediaIds, ...newMediaIds])
            const mergedAttachments: AttachmentItem[] = []

            for (const mediaId of allAttachmentMediaIds) {
                const uploadResult = uploadResults.find((r) => r.media.id === mediaId)
                if (uploadResult) {
                    const responseAtt = responseAttachmentMap.get(mediaId) as { id?: string; title?: string | null } | undefined
                    mergedAttachments.push({
                        id: responseAtt?.id || uploadResult.media.id,
                        mediaId: uploadResult.media.id,
                        title: uploadResult.media.originalFilename || responseAtt?.title || null,
                        sizeBytes: uploadResult.media.sizeBytes,
                    })
                    continue
                }

                const responseAtt = responseAttachmentMap.get(mediaId) as { id: string; mediaId: string; title?: string | null } | undefined
                if (responseAtt && responseAtt.mediaId) {
                    const existingAttachment = existingAttachmentsMap.get(mediaId)
                    const existingDetails = allDetailsMap.get(mediaId)
                    mergedAttachments.push({
                        id: responseAtt.id,
                        mediaId: responseAtt.mediaId,
                        sizeBytes: existingDetails?.sizeBytes || existingAttachment?.sizeBytes,
                        title: existingDetails?.originalFilename || existingAttachment?.title || responseAtt.title || null,
                    })
                    continue
                }

                const existingAttachment = existingAttachmentsMap.get(mediaId)
                if (existingAttachment) {
                    mergedAttachments.push(existingAttachment)
                }
            }

            onAttachmentsUpdate(mergedAttachments)
            toast.success(`Successfully uploaded ${files.length} file(s)`)
        } catch (error: any) {
            console.error("Failed to upload attachment:", error)
            onAttachmentsUpdate(attachments)
            toast.error(error?.message || "Failed to upload attachment")
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleDeleteAttachment = async (attachment: AttachmentItem) => {
        if (!task?.id || !workspaceId) return

        const updatedAttachments = attachments.filter((a) => a.id !== attachment.id)
        onAttachmentsUpdate(updatedAttachments)

        try {
            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                attachmentMediaIds: updatedAttachments.filter((a) => !a.mediaId.startsWith('temp-')).map((a) => a.mediaId),
            })

            if (!attachment.mediaId.startsWith('temp-')) {
                try {
                    await apiClient.deleteMedia(workspaceId, attachment.mediaId)
                } catch (mediaError: any) {
                    console.error("Failed to delete media file:", mediaError)
                }
            }

            if (response?.task?.attachments && response.task.attachments.length > 0) {
                const currentDetails = new Map(attachmentDetails)
                currentDetails.delete(attachment.mediaId)

                const preservedAttachments = response.task.attachments.map((att: any) => {
                    const existingAttachment = updatedAttachments.find((a) => a.mediaId === att.mediaId)
                    const existingDetails = currentDetails.get(att.mediaId)
                    return {
                        ...att,
                        sizeBytes: existingDetails?.sizeBytes || existingAttachment?.sizeBytes,
                        title: existingDetails?.originalFilename || existingAttachment?.title || att.title,
                    }
                })
                onAttachmentsUpdate(preservedAttachments)
                onAttachmentDetailsUpdate(currentDetails)
            } else {
                onAttachmentDetailsUpdate((prev) => {
                    const newMap = new Map(prev)
                    newMap.delete(attachment.mediaId)
                    return newMap
                })
            }

            toast.success("Attachment deleted successfully")
        } catch (error: any) {
            console.error("Failed to delete attachment:", error)
            toast.error(error?.message || "Failed to delete attachment")
            onAttachmentsUpdate(attachments)
        }
    }

    return (
        <div className="flex flex-col gap-3 pl-0 md:pl-2 pt-6 border-t border-muted-foreground/20 mt-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <IconPaperclip className="h-4 w-4" />
                    Attachments
                    {attachments.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                            {attachments.length}
                        </Badge>
                    )}
                </h3>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <IconUpload className="h-4 w-4" />
                </Button>
            </div>

            {attachments.length > 0 && (
                <div className="flex flex-col gap-2">
                    {attachments.map((attachment) => {
                        const details = attachmentDetails.get(attachment.mediaId)
                        const sizeBytes = attachment.sizeBytes || details?.sizeBytes || 0
                        const fileName = attachment.title || details?.originalFilename || `Attachment ${attachment.id.slice(0, 8)}`
                        const fileExtension = getFileExtension(fileName)

                        return (
                            <div
                                key={attachment.id}
                                className="flex items-center gap-2 p-2.5 rounded-md border border-border/60 hover:bg-accent/50 hover:border-border/70 transition-colors group"
                            >
                                <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate" title={fileName}>
                                        {fileName}
                                    </div>
                                    {(fileExtension || sizeBytes > 0) && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            {fileExtension && (
                                                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                                    {fileExtension}
                                                </span>
                                            )}
                                            {sizeBytes > 0 && (
                                                <span>{formatFileSize(sizeBytes)}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <a
                                        href={apiClient.getMediaUrl(workspaceId, attachment.mediaId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                        >
                                            <IconDownload className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                        </Button>
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteAttachment(attachment)
                                        }}
                                    >
                                        <IconTrash className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
