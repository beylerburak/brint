import React, { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconSearch, IconFile, IconPhoto, IconVideo, IconFileText, IconLoader2, IconFolder, IconX, IconArrowLeft } from "@tabler/icons-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { isImageType, isVideoType } from "@brint/shared-config/upload"

interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  thumbnailLink?: string
  size?: string
  parents?: string[]
}

interface ContentPreviewPanelProps {
  isGoogleDriveAvailable: boolean
  onFilesSelected: (mediaItems: Array<{
    id: string
    preview: string
    type: 'image' | 'video' | 'document'
    mediaId: string
  }>) => void
  showGoogleDrivePicker: boolean
  onShowGoogleDrivePickerChange: (show: boolean) => void
}

export const ContentPreviewPanel = React.memo(function ContentPreviewPanel({
  isGoogleDriveAvailable,
  onFilesSelected,
  showGoogleDrivePicker,
  onShowGoogleDrivePickerChange,
}: ContentPreviewPanelProps) {
  const t = useTranslations("contentCreation")
  const { currentWorkspace } = useWorkspace()
  const [files, setFiles] = useState<GoogleDriveFile[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const nextPageTokenRef = useRef<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState(false)
  
  // Keep ref in sync with state
  useEffect(() => {
    nextPageTokenRef.current = nextPageToken
  }, [nextPageToken])

  const getThumbnailUrl = (fileId: string): string | undefined => {
    if (!currentWorkspace) return undefined
    const baseUrl = apiClient.getGoogleDriveThumbnailUrl(currentWorkspace.id, fileId)
    return baseUrl.includes('?') ? baseUrl : `${baseUrl}?workspaceId=${currentWorkspace.id}`
  }

  const loadFiles = useCallback(async (reset = false) => {
    if (!currentWorkspace) return
    
    setIsLoading(true)
    try {
      // Use ref to get current page token (always up-to-date)
      const currentPageToken = reset ? undefined : nextPageTokenRef.current
      
      const res = await apiClient.listGoogleDriveFiles(currentWorkspace.id, {
        query: searchQuery || undefined,
        pageSize: reset ? 10 : 100,
        pageToken: currentPageToken,
        folderId: undefined,
        driveId: undefined,
      })
      
      if (reset) {
        setFiles(res.files || [])
      } else {
        setFiles(prev => [...prev, ...(res.files || [])])
      }
      
      setNextPageToken(res.nextPageToken)
      setHasMore(!!res.nextPageToken)
    } catch (error: any) {
      console.error('Failed to load Google Drive files:', error)
      toast.error('Failed to load files', {
        description: error.message || 'An error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace, searchQuery])

  useEffect(() => {
    if (!showGoogleDrivePicker || !currentWorkspace) return
    
    const timer = setTimeout(() => {
      setNextPageToken(undefined)
      setShowAllFiles(false)
      void loadFiles(true)
    }, searchQuery ? 500 : 0)

    return () => clearTimeout(timer)
  }, [searchQuery, showGoogleDrivePicker, currentWorkspace, loadFiles])

  useEffect(() => {
    if (showGoogleDrivePicker && currentWorkspace) {
      setFiles([])
      setSelectedFileIds(new Set())
      setSearchQuery('')
      setNextPageToken(undefined)
      setHasMore(false)
      setShowAllFiles(false)
    }
  }, [showGoogleDrivePicker, currentWorkspace])

  const isSelectableFile = (mimeType: string): boolean => {
    return isImageType(mimeType) || isVideoType(mimeType)
  }

  const isFolder = (mimeType: string) => {
    return mimeType === 'application/vnd.google-apps.folder'
  }

  const handleFileToggle = (fileId: string, mimeType: string) => {
    if (isFolder(mimeType) || !isSelectableFile(mimeType)) return
    
    setSelectedFileIds(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const handleImport = async () => {
    if (selectedFileIds.size === 0 || !currentWorkspace) return

    const invalidFiles = Array.from(selectedFileIds)
      .map(id => files.find(f => f.id === id))
      .filter((file): file is GoogleDriveFile => !!file && !isSelectableFile(file.mimeType))
    
    if (invalidFiles.length > 0) {
      toast.error('Invalid file types selected', {
        description: 'Only images and videos can be imported. Please deselect unsupported files.',
      })
      return
    }

    setIsImporting(true)
    try {
      const mediaItems: Array<{
        id: string
        preview: string
        type: 'image' | 'video' | 'document'
        mediaId: string
      }> = []

      for (const fileId of selectedFileIds) {
        try {
          const res = await apiClient.importGoogleDriveFile(currentWorkspace.id, fileId)
          
          let type: 'image' | 'video' | 'document' = 'document'
          if (isImageType(res.media.mimeType)) {
            type = 'image'
          } else if (isVideoType(res.media.mimeType)) {
            type = 'video'
          }

          mediaItems.push({
            id: `drive-media-${res.media.id}`,
            preview: res.media.previewUrl,
            type,
            mediaId: res.media.id,
          })
        } catch (error: any) {
          console.error(`Failed to import file ${fileId}:`, error)
          toast.error(`Failed to import ${files.find(f => f.id === fileId)?.name || 'file'}`, {
            description: error.message || 'An error occurred',
          })
        }
      }

      if (mediaItems.length > 0) {
        onFilesSelected(mediaItems)
        toast.success(`Imported ${mediaItems.length} file(s)`)
        onShowGoogleDrivePickerChange(false)
        setSelectedFileIds(new Set())
      }
    } catch (error: any) {
      console.error('Failed to import files:', error)
      toast.error('Failed to import files', {
        description: error.message || 'An error occurred',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (isFolder(mimeType)) {
      return <IconFolder className="h-5 w-5 text-yellow-500" />
    }
    if (mimeType.startsWith('image/')) {
      return <IconPhoto className="h-5 w-5 text-blue-500" />
    }
    if (mimeType.startsWith('video/')) {
      return <IconVideo className="h-5 w-5 text-purple-500" />
    }
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      return <IconFileText className="h-5 w-5 text-red-500" />
    }
    return <IconFile className="h-5 w-5 text-gray-500" />
  }

  if (showGoogleDrivePicker) {
    return (
      <div className="w-full lg:w-[40%] xl:w-[35%] bg-muted/30 overflow-y-auto flex flex-col">
        <div className="p-4 sm:p-6 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShowGoogleDrivePickerChange(false)}
              className="h-8 w-8"
            >
              <IconArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-medium">Choose from Google Drive</h3>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchQuery ? "Searching entire Drive..." : "Search files or browse recent files..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 mb-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No files found
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(showAllFiles || files.length <= 10 ? files : files.slice(0, 10)).map((file) => {
                    const isSelected = selectedFileIds.has(file.id)
                    const isImage = isImageType(file.mimeType)
                    const isVideo = isVideoType(file.mimeType)
                    const fileIsFolder = isFolder(file.mimeType)
                    const isSelectable = isSelectableFile(file.mimeType)
                    const isDisabled = !fileIsFolder && !isSelectable
                    const shouldTryThumbnail = !fileIsFolder && (isImage || isVideo)
                    
                    return (
                      <FileThumbnail
                        key={file.id}
                        file={file}
                        isSelected={isSelected}
                        isImage={isImage}
                        isVideo={isVideo}
                        hasThumbnail={shouldTryThumbnail}
                        fileIsFolder={fileIsFolder}
                        isSelectable={isSelectable}
                        isDisabled={isDisabled}
                        onToggle={() => handleFileToggle(file.id, file.mimeType)}
                        getFileIcon={getFileIcon}
                        getThumbnailUrl={getThumbnailUrl}
                      />
                    )
                  })}
                </div>
                
                {(hasMore || (files.length > 10 && !showAllFiles)) && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (files.length > 10 && !hasMore && !showAllFiles) {
                          setShowAllFiles(true)
                        } else if (hasMore) {
                          void loadFiles(false)
                        }
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : files.length > 10 && !hasMore && !showAllFiles ? (
                        `Show All (${files.length})`
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGoogleDrivePicker(false)}
              disabled={isImporting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedFileIds.size === 0 || isImporting}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import & Add (${selectedFileIds.size})`
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full lg:w-[40%] xl:w-[35%] bg-muted/30 overflow-y-auto">
      <div className="p-4 sm:p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">{t("preview")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("previewPlaceholder")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

// Separate component for file thumbnail with state management
function FileThumbnail({
  file,
  isSelected,
  isImage,
  isVideo,
  hasThumbnail,
  fileIsFolder,
  isSelectable,
  isDisabled,
  onToggle,
  getFileIcon,
  getThumbnailUrl,
}: {
  file: GoogleDriveFile
  isSelected: boolean
  isImage: boolean
  isVideo: boolean
  hasThumbnail: boolean
  fileIsFolder: boolean
  isSelectable: boolean
  isDisabled: boolean
  onToggle: () => void
  getFileIcon: (mimeType: string) => React.ReactNode
  getThumbnailUrl: (fileId: string) => string | undefined
}) {
  const { currentWorkspace } = useWorkspace()
  const [thumbnailError, setThumbnailError] = useState(false)
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
  const [thumbnailBlobUrl, setThumbnailBlobUrl] = useState<string | null>(null)

  const showThumbnail = !fileIsFolder && hasThumbnail && (isImage || isVideo) && !thumbnailError
  const thumbnailUrl = showThumbnail ? getThumbnailUrl(file.id) : undefined

  // Load thumbnail as blob to ensure credentials are sent
  useEffect(() => {
    if (!thumbnailUrl || thumbnailBlobUrl || !currentWorkspace) return

    let cancelled = false

    const loadThumbnail = async () => {
      try {
        const urlWithWorkspace = thumbnailUrl.includes('workspaceId=') 
          ? thumbnailUrl 
          : `${thumbnailUrl}${thumbnailUrl.includes('?') ? '&' : '?'}workspaceId=${currentWorkspace.id}`
        
        const response = await fetch(urlWithWorkspace, {
          credentials: 'include',
          headers: {
            'X-Workspace-Id': currentWorkspace.id,
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to load thumbnail: ${response.status}`)
        }

        const blob = await response.blob()
        
        if (!cancelled) {
          const blobUrl = URL.createObjectURL(blob)
          setThumbnailBlobUrl(blobUrl)
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error)
        if (!cancelled) {
          setThumbnailError(true)
        }
      }
    }

    loadThumbnail()

    return () => {
      cancelled = true
      if (thumbnailBlobUrl) {
        URL.revokeObjectURL(thumbnailBlobUrl)
      }
    }
  }, [thumbnailUrl, thumbnailBlobUrl, currentWorkspace])

  return (
    <div
      className={`
        border rounded-lg overflow-hidden transition-all relative cursor-pointer
        ${isDisabled 
          ? 'opacity-50 cursor-not-allowed border-border/50' 
          : isSelected 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50'
        }
      `}
      onClick={() => {
        if (!fileIsFolder && isSelectable) {
          onToggle()
        }
      }}
    >
      {/* Thumbnail or Icon */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {showThumbnail && thumbnailBlobUrl ? (
          <>
            {!thumbnailLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                {getFileIcon(file.mimeType)}
              </div>
            )}
            <img
              src={thumbnailBlobUrl}
              alt={file.name}
              className={`w-full h-full object-cover ${thumbnailLoaded ? 'block' : 'hidden'}`}
              onLoad={() => setThumbnailLoaded(true)}
              onError={() => {
                setThumbnailError(true)
                setThumbnailLoaded(false)
              }}
            />
          </>
        ) : showThumbnail && !thumbnailError ? (
          <div className="w-full h-full flex items-center justify-center">
            {getFileIcon(file.mimeType)}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {getFileIcon(file.mimeType)}
          </div>
        )}
        
        {/* Selection checkbox overlay (only for selectable files) */}
        {isSelectable && (
          <div className="absolute top-2 left-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="bg-background/80"
              disabled={isDisabled}
            />
          </div>
        )}
        
        {/* Folder indicator */}
        {fileIsFolder && (
          <div className="absolute top-2 right-2">
            <IconFolder className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        
        {/* Not selectable indicator */}
        {isDisabled && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <div className="bg-background/90 rounded-full p-2 border border-border">
              <IconX className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
      
      {/* File info */}
      <div className="p-2">
        <p className="text-xs font-medium truncate" title={file.name}>
          {file.name}
        </p>
        {!fileIsFolder && (
          <p className="text-xs text-muted-foreground truncate">
            {isDisabled ? 'Not supported' : file.mimeType}
          </p>
        )}
      </div>
    </div>
  )
}

