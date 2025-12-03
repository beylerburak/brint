"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  File,
} from "lucide-react";
import { cn } from "@/shared/utils";

export interface MediaViewerFile {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  url: string; // Presigned or CDN URL
}

interface MediaViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: MediaViewerFile[];
  currentIndex: number;
  onNavigate?: (index: number) => void;
  onDownload?: (file: MediaViewerFile) => void;
}

export function MediaViewerModal({
  open,
  onOpenChange,
  files,
  currentIndex,
  onNavigate,
  onDownload,
}: MediaViewerModalProps) {
  const currentFile = files[currentIndex];
  const hasMultiple = files.length > 1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate?.(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      onNavigate?.(currentIndex + 1);
    }
  };

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        onNavigate?.(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < files.length - 1) {
        onNavigate?.(currentIndex + 1);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [open, currentIndex, files.length, onNavigate, onOpenChange]
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!currentFile) return null;

  const isImage = currentFile.contentType.startsWith("image/");
  const isVideo = currentFile.contentType.startsWith("video/");
  const isAudio = currentFile.contentType.startsWith("audio/");
  const isPDF = currentFile.contentType === "application/pdf";

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 gap-0 flex flex-col bg-black/95 border-border/50">
        <DialogTitle className="sr-only">{currentFile.originalName}</DialogTitle>
        <DialogDescription className="sr-only">
          Media file viewer - {currentFile.contentType}
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/20 bg-black/50 backdrop-blur-sm">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white truncate">
              {currentFile.originalName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(currentFile.sizeBytes)} • {currentFile.contentType}
            </p>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {hasMultiple && (
              <div className="text-xs text-muted-foreground px-3 py-1 bg-background/10 rounded">
                {currentIndex + 1} / {files.length}
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload?.(currentFile)}
              className="text-white hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(currentFile.url, "_blank")}
              className="text-white hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Navigation Buttons */}
          {hasMultiple && currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-4 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {hasMultiple && currentIndex < files.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 z-10 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Media Content */}
          <div className="w-full h-full flex items-center justify-center p-8">
            {isImage && (
              <img
                src={currentFile.url}
                alt={currentFile.originalName}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            )}

            {isVideo && (
              <video
                src={currentFile.url}
                controls
                className="max-w-full max-h-full rounded-lg"
                autoPlay
              >
                Your browser does not support the video tag.
              </video>
            )}

            {isAudio && (
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <File className="h-16 w-16 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{currentFile.originalName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatFileSize(currentFile.sizeBytes)}
                  </p>
                </div>
                <audio
                  src={currentFile.url}
                  controls
                  className="w-96 mt-4"
                  autoPlay
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            )}

            {isPDF && (
              <iframe
                src={currentFile.url}
                className="w-full h-full rounded-lg bg-white"
                title={currentFile.originalName}
              />
            )}

            {!isImage && !isVideo && !isAudio && !isPDF && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/5 flex items-center justify-center">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-white font-medium mb-2">{currentFile.originalName}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Preview not available for this file type
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => onDownload?.(currentFile)}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thumbnail Strip (if multiple files) */}
        {hasMultiple && (
          <div className="border-t border-border/20 bg-black/50 backdrop-blur-sm p-4">
            <div className="flex gap-2 overflow-x-auto">
              {files.map((file, index) => {
                const isActive = index === currentIndex;
                const thumbIsImage = file.contentType.startsWith("image/");
                
                return (
                  <button
                    key={file.id}
                    onClick={() => onNavigate?.(index)}
                    className={cn(
                      "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                      isActive
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-transparent hover:border-white/20"
                    )}
                  >
                    {thumbIsImage ? (
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

