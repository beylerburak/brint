import React, { useState, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IconX, IconGripVertical, IconVideo, IconFileUpload } from "@tabler/icons-react"
import type { ContentMediaItem } from "../content-creation.types"

interface ContentMediaItemSortableProps {
  media: ContentMediaItem
  onRemove: (id: string) => void
}

export const ContentMediaItemSortable = React.memo(function ContentMediaItemSortable({
  media,
  onRemove,
}: ContentMediaItemSortableProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id })

  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)

  // Generate video thumbnail
  useEffect(() => {
    if (media.type === 'video' && media.preview && !videoThumbnail) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      
      const handleLoadedMetadata = () => {
        const seekTime = Math.min(1, video.duration / 2)
        video.currentTime = seekTime
      }
      
      const handleSeeked = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
            setVideoThumbnail(thumbnail)
          }
        } catch (error) {
          console.error('Failed to generate video thumbnail:', error)
          setVideoThumbnail(null)
        }
      }
      
      const handleError = () => {
        setVideoThumbnail(null)
      }
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('seeked', handleSeeked)
      video.addEventListener('error', handleError)
      
      video.src = media.preview
      video.load()
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('seeked', handleSeeked)
        video.removeEventListener('error', handleError)
        video.src = ''
      }
    }
  }, [media.type, media.preview, videoThumbnail])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted"
    >
      {/* Thumbnail */}
      {media.type === 'image' ? (
        <img
          src={media.preview}
          alt={media.file?.name || media.mediaId || 'Media'}
          className="w-full h-full object-cover"
        />
      ) : media.type === 'video' ? (
        <div className="w-full h-full relative">
          {videoThumbnail ? (
            <>
              <img
                src={videoThumbnail}
                alt={media.file?.name || media.mediaId || 'Video'}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-xs text-white flex items-center gap-1">
                <IconVideo className="h-3 w-3" />
                <span>Video</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <IconVideo className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <IconFileUpload className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <IconGripVertical className="h-4 w-4 text-white" />
      </div>
      
      {/* Remove Button */}
      <button
        type="button"
        onClick={() => onRemove(media.id)}
        className="absolute top-2 right-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      >
        <IconX className="h-4 w-4 text-white" />
      </button>
      
      {/* Video Indicator */}
      {media.type === 'video' && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-xs text-white flex items-center gap-1">
          <IconVideo className="h-3 w-3" />
          <span>Video</span>
        </div>
      )}
    </div>
  )
})

