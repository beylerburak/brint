import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  DndContext, 
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { IconFileUpload, IconChevronDown, IconMoodSmile, IconHash, IconSparkles, IconBrandGoogleDrive, IconCheck, IconCopy } from "@tabler/icons-react"
import type { ContentFormFactor } from "@brint/shared-config/platform-rules"
import type { ContentMediaItem } from "../content-creation.types"
import { ContentMediaItemSortable } from "./content-media-item-sortable"
import type { DragEndEvent } from "@dnd-kit/core"
import type { SensorDescriptor } from "@dnd-kit/core"

interface ContentCaptionAndMediaProps {
  formFactor: ContentFormFactor | null
  caption: string
  onCaptionChange: (value: string) => void
  isBaseCaptionExceeded: boolean
  globalCaptionLimit: number | null
  selectedMedia: ContentMediaItem[]
  getRootProps: () => any
  getInputProps: () => any
  isDragActive: boolean
  maxFilesAllowed: number
  onDragEnd: (event: DragEndEvent) => void
  onRemoveMedia: (id: string) => void
  sensors: SensorDescriptor<any>[]
  isGoogleDriveAvailable: boolean
  isCheckingGoogleDrive: boolean
  onOpenDrivePicker: () => void
  useMediaLookupOnPublish: boolean
  onUseMediaLookupChange: (checked: boolean) => void
  mediaLookupId?: string
}

export const ContentCaptionAndMedia = React.memo(function ContentCaptionAndMedia({
  formFactor,
  caption,
  onCaptionChange,
  isBaseCaptionExceeded,
  globalCaptionLimit,
  selectedMedia,
  getRootProps,
  getInputProps,
  isDragActive,
  maxFilesAllowed,
  onDragEnd,
  onRemoveMedia,
  sensors,
  isGoogleDriveAvailable,
  isCheckingGoogleDrive,
  onOpenDrivePicker,
  useMediaLookupOnPublish,
  onUseMediaLookupChange,
  mediaLookupId,
}: ContentCaptionAndMediaProps) {
  const t = useTranslations("contentCreation")
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyMediaLookupId = async () => {
    if (!mediaLookupId) return
    
    try {
      await navigator.clipboard.writeText(mediaLookupId)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="space-y-0 border border-border rounded-lg overflow-hidden">
      {/* Caption Textarea - Hidden for STORY */}
      {formFactor !== 'STORY' && (
        <div className="relative">
          <Textarea
            id="caption"
            placeholder={t("captionPlaceholder")}
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            rows={8}
            className={`resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none min-h-[200px] ${
              isBaseCaptionExceeded ? 'text-destructive' : ''
            }`}
            aria-invalid={isBaseCaptionExceeded}
          />
          {isBaseCaptionExceeded && globalCaptionLimit !== null && (
            <div className="absolute bottom-2 left-3 text-xs text-destructive">
              {t("captionTooLong", { limit: globalCaptionLimit })}
            </div>
          )}
        </div>
      )}
      
      {/* Media Upload Area */}
      <div className={formFactor !== 'STORY' ? 'border-t border-border' : ''}>
        {/* Selected Media Thumbnails */}
        {selectedMedia.length > 0 && (
          <div className="p-3 border-b border-border">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={selectedMedia.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-5 gap-2">
                  {selectedMedia.map((media) => (
                    <ContentMediaItemSortable
                      key={media.id}
                      media={media}
                      onRemove={onRemoveMedia}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
        
        {/* Dropzone and Media Lookup Toggle Card - Side by Side */}
        <div className="m-3 flex gap-3">
          {/* Media Lookup Toggle Card - Left Side */}
          <div
            onClick={() => onUseMediaLookupChange(!useMediaLookupOnPublish)}
            className="w-1/2 text-left p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <Switch
                id="use-media-lookup"
                checked={useMediaLookupOnPublish}
                onCheckedChange={(checked) => {
                  onUseMediaLookupChange(checked)
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label htmlFor="use-media-lookup" className="text-xs font-medium cursor-pointer">
                  {t("useMediaLookupOnPublishLabel") || "Medya yüklemeden paylaş"}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("useMediaLookupOnPublishDescription") || "Bu seçenek açıkken, medya yüklemesen bile paylaşım sırasında bu içerik için oluşturulan medya anahtarıyla Drive'da dosya aranır."}
                </p>
              </div>
            </div>
            
            {/* Media Lookup ID Display - Only show when toggle is ON */}
            {useMediaLookupOnPublish && mediaLookupId && (
              <div className="mt-3 space-y-1.5">
                <Label className="text-[11px] text-muted-foreground block">
                  {t("mediaLookupIdLabel") || "Medya anahtarı:"}
                </Label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyMediaLookupId()
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded bg-background border border-border hover:bg-accent transition-colors group cursor-pointer"
                >
                  <code className="text-[10px] font-mono whitespace-nowrap">
                    {mediaLookupId}
                  </code>
                  {isCopied ? (
                    <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 flex-shrink-0">
                      <IconCheck className="h-3 w-3" />
                      <span>{t("copied") || "Kopyalandı"}</span>
                    </div>
                  ) : (
                    <IconCopy className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                  )}
                </button>
              </div>
            )}
          </div>
          
          {/* Dropzone - Right Side */}
          <div
            {...(useMediaLookupOnPublish ? {} : getRootProps())}
            className={`w-1/2 border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              useMediaLookupOnPublish
                ? 'border-border/50 cursor-not-allowed opacity-50'
                : isDragActive
                ? 'border-primary bg-primary/5'
                : selectedMedia.length >= maxFilesAllowed
                ? 'border-border/50 cursor-not-allowed opacity-50'
                : 'border-border hover:border-primary/50 cursor-pointer'
            }`}
          >
            <input {...(useMediaLookupOnPublish ? {} : getInputProps())} disabled={useMediaLookupOnPublish} />
            <IconFileUpload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-0.5">
              {isDragActive ? (
                <span>{t("dropFilesHere")}</span>
              ) : selectedMedia.length >= maxFilesAllowed ? (
                <span>{t("maxFilesReached")}</span>
              ) : (
                <>
                  {t("dragDropOrSelect").split("select files")[0]}
                  <span className="text-primary underline">{t("selectFiles")}</span>
                </>
              )}
            </p>
            {selectedMedia.length > 0 && selectedMedia.length < maxFilesAllowed && (
              <p className="text-xs text-muted-foreground mt-1">
                {formFactor === 'VERTICAL_VIDEO' ? (
                  selectedMedia.length === 1 
                    ? t("filesSelectedVerticalSingle", { count: selectedMedia.length }) || `${selectedMedia.length} video selected`
                    : t("filesSelectedVertical", { count: selectedMedia.length, max: maxFilesAllowed }) || `${selectedMedia.length} of ${maxFilesAllowed} videos selected`
                ) : (
                  t("filesSelected", { count: selectedMedia.length, max: maxFilesAllowed }) || `${selectedMedia.length} of ${maxFilesAllowed} files selected`
                )}
              </p>
            )}
            {/* Google Drive button */}
            {isGoogleDriveAvailable && selectedMedia.length < maxFilesAllowed && !useMediaLookupOnPublish && (
              <div className="mt-2 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenDrivePicker()
                  }}
                  className="h-8 text-xs gap-1"
                  disabled={isCheckingGoogleDrive}
                >
                  <IconBrandGoogleDrive className="h-3 w-3" />
                  <span>{t("chooseFromDrive") || "Choose from Google Drive"}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Toolbar - Hidden for STORY */}
      {formFactor !== 'STORY' && (
        <div className="border-t border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              // TODO: Open add content menu
            }}
          >
            <IconChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              // TODO: Open emoji picker
            }}
          >
            <IconMoodSmile className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              // TODO: Add hashtag
            }}
          >
            <IconHash className="h-4 w-4" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {caption.length}
              {globalCaptionLimit !== null && (
                <span className={isBaseCaptionExceeded ? 'text-destructive' : 'text-muted-foreground'}>
                  /{globalCaptionLimit}
                </span>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                // TODO: Open AI assistant
              }}
            >
              <IconSparkles className="h-4 w-4" />
              <span className="text-xs">AI Assistant</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
})

