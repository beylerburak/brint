import { useState, useEffect, useCallback, useMemo } from "react"
import { useDropzone } from "react-dropzone"
import { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { ContentFormFactor } from "@brint/shared-config/platform-rules"
import type { ContentMediaItem } from "../content-creation.types"
import { 
  MAX_FILE_SIZE_BYTES, 
  MAX_FILE_SIZE_MB,
  getFileTypeCategory 
} from "@brint/shared-config/upload"

interface UseMediaManagerProps {
  formFactor: ContentFormFactor | null
  currentWorkspaceId?: string
  onRemoveMediaFromBackend?: (mediaId: string) => Promise<void>
}

export function useMediaManager({
  formFactor,
  currentWorkspaceId,
  onRemoveMediaFromBackend,
}: UseMediaManagerProps) {
  const t = useTranslations("contentCreation")
  
  const [selectedMedia, setSelectedMedia] = useState<ContentMediaItem[]>([])

  // Calculate max files based on form factor
  const isVerticalVideo = formFactor === 'VERTICAL_VIDEO'
  const maxFilesAllowed = useMemo(() => isVerticalVideo ? 1 : 10, [isVerticalVideo])

  // File extensions for dropzone
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov']

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: isVerticalVideo
      ? { 'video/*': videoExtensions }
      : { 
          'image/*': imageExtensions,
          'video/*': videoExtensions,
        },
    maxSize: MAX_FILE_SIZE_BYTES,
    maxFiles: maxFilesAllowed,
    onDrop: useCallback((acceptedFiles, rejectedFiles) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const hasFileTooLarge = rejectedFiles.some(r => r.errors.some(e => e.code === 'file-too-large'))
        const hasFileTypeError = rejectedFiles.some(r => r.errors.some(e => e.code === 'file-invalid-type'))
        
        if (hasFileTooLarge) {
          toast.error(t('content.fileTooLarge') || `File size exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB`)
        }
        if (hasFileTypeError && isVerticalVideo) {
          toast.error(t('content.onlyVideosAllowed') || 'Only video files are allowed for vertical video')
        }
      }
      
      // For vertical video, only allow videos and replace existing media
      if (isVerticalVideo) {
        const videoFiles = acceptedFiles.filter(file => {
          const category = getFileTypeCategory(file.type)
          return category === 'video'
        })
        
        if (videoFiles.length > 0) {
          // Clean up existing media blob URLs
          setSelectedMedia(prev => {
            prev.forEach(media => {
              if (media.file && media.preview) {
                try { URL.revokeObjectURL(media.preview) } catch {}
              }
            })
            return []
          })
          
          const newVideo = videoFiles[0]
          const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const preview = URL.createObjectURL(newVideo)
          
          setSelectedMedia([{
            id,
            file: newVideo,
            preview,
            type: 'video',
          }])
          
          if (videoFiles.length > 1) {
            toast.warning(t('content.onlyOneVideoAllowed') || 'Only one video is allowed for vertical video. Using the first video.')
          }
        } else if (acceptedFiles.length > 0) {
          toast.error(t('content.onlyVideosAllowed') || 'Only video files are allowed for vertical video')
        }
        return
      }
      
      // For other form factors, process normally
      const newMedia = acceptedFiles
        .slice(0, maxFilesAllowed - selectedMedia.length)
        .map(file => {
          const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const preview = URL.createObjectURL(file)
          const category = getFileTypeCategory(file.type)
          const type: 'image' | 'video' | 'document' = category === 'unknown' ? 'image' : category
          
          return {
            id,
            file,
            preview,
            type,
          }
        })
      
      setSelectedMedia(prev => [...prev, ...newMedia])
    }, [isVerticalVideo, maxFilesAllowed, selectedMedia.length, t]),
    disabled: selectedMedia.length >= maxFilesAllowed,
  })

  // Handle drag end for media reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setSelectedMedia((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  // Remove media
  const handleRemoveMedia = useCallback(async (mediaId: string) => {
    const media = selectedMedia.find(m => m.id === mediaId)
    
    // If media has a mediaId (imported from Google Drive or existing media), delete from backend
    if (media?.mediaId && currentWorkspaceId && onRemoveMediaFromBackend) {
      try {
        await onRemoveMediaFromBackend(media.mediaId)
        toast.success(t("mediaDeleted") || "Media deleted successfully")
      } catch (error: any) {
        console.error('Failed to delete media:', error)
        toast.error(t("mediaDeleteError") || "Failed to delete media", {
          description: error.message || t("mediaDeleteErrorDescription") || "An error occurred"
        })
      }
    }
    
    // Clean up blob URLs for local files
    if (media && media.file && media.preview) {
      try {
        URL.revokeObjectURL(media.preview)
      } catch {}
    }
    
    // Remove from state
    setSelectedMedia(prev => prev.filter(m => m.id !== mediaId))
  }, [selectedMedia, currentWorkspaceId, onRemoveMediaFromBackend, t])

  // Add media from Google Drive
  const addMediaFromGoogleDrive = useCallback((mediaItems: ContentMediaItem[]) => {
    if (isVerticalVideo) {
      const firstVideo = mediaItems.find(m => m.type === 'video')
      if (!firstVideo) {
        toast.warning(t('content.onlyVideosAllowed') || 'Only video files are allowed for vertical video')
        return
      }
      // Clean up existing blob previews
      setSelectedMedia(prev => {
        prev.forEach(m => {
          if (m.file && m.preview) {
            try { URL.revokeObjectURL(m.preview) } catch {}
          }
        })
        return []
      })
      setSelectedMedia([firstVideo])
      return
    }

    // Normal case: add to existing list, stay within limit
    setSelectedMedia(prev => {
      const availableSlots = maxFilesAllowed - prev.length
      const toAdd = mediaItems.slice(0, availableSlots)
      return [...prev, ...toAdd]
    })
  }, [isVerticalVideo, maxFilesAllowed, t])

  // Clean up blob URLs when form factor changes to vertical video
  useEffect(() => {
    if (isVerticalVideo) {
      setSelectedMedia(prev => {
        const videoMedia = prev.filter(m => m.type === 'video')
        // Clean up preview URLs for removed media
        prev.forEach(media => {
          if (media.type !== 'video' && media.file && media.preview) {
            try { URL.revokeObjectURL(media.preview) } catch {}
          }
        })
        // If multiple videos exist, keep only the first one
        if (videoMedia.length > 1) {
          videoMedia.slice(1).forEach(media => {
            if (media.file && media.preview) {
              try { URL.revokeObjectURL(media.preview) } catch {}
            }
          })
          return [videoMedia[0]]
        }
        return videoMedia
      })
    }
  }, [isVerticalVideo])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      selectedMedia.forEach(media => {
        if (media.file && media.preview) {
          try { URL.revokeObjectURL(media.preview) } catch {}
        }
      })
    }
  }, [selectedMedia])

  return {
    selectedMedia,
    setSelectedMedia,
    getRootProps,
    getInputProps,
    isDragActive,
    handleDragEnd,
    handleRemoveMedia,
    addMediaFromGoogleDrive,
    maxFilesAllowed,
    isVerticalVideo,
  }
}

