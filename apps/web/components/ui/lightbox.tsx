"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/shared/utils";

export interface LightboxProps {
  /** Array of image URLs */
  images: string[];
  /** Currently open image index */
  currentIndex: number | null;
  /** Callback when lightbox should close */
  onClose: () => void;
  /** Callback when image index changes */
  onIndexChange?: (index: number) => void;
  /** Optional title for each image */
  getImageTitle?: (index: number) => string;
  /** Optional alt text for each image */
  getImageAlt?: (index: number) => string;
  /** Optional className */
  className?: string;
}

export function Lightbox({
  images,
  currentIndex,
  onClose,
  onIndexChange,
  getImageTitle,
  getImageAlt,
  className,
}: LightboxProps) {
  const currentImage = currentIndex !== null ? images[currentIndex] : null;
  const hasPrevious = currentIndex !== null && currentIndex > 0;
  const hasNext = currentIndex !== null && currentIndex < images.length - 1;

  const goToPrevious = React.useCallback(() => {
    if (currentIndex === null || !hasPrevious) return;
    const newIndex = currentIndex - 1;
    onIndexChange?.(newIndex);
  }, [currentIndex, hasPrevious, onIndexChange]);

  const goToNext = React.useCallback(() => {
    if (currentIndex === null || !hasNext) return;
    const newIndex = currentIndex + 1;
    onIndexChange?.(newIndex);
  }, [currentIndex, hasNext, onIndexChange]);

  // Keyboard navigation
  React.useEffect(() => {
    if (currentIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goToNext();
          break;
        case "Escape":
          event.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, goToPrevious, goToNext, onClose]);

  if (currentImage === null) return null;

  const imageTitle = getImageTitle
    ? getImageTitle(currentIndex!)
    : `Image ${currentIndex! + 1} of ${images.length}`;
  const imageAlt = getImageAlt
    ? getImageAlt(currentIndex!)
    : imageTitle;

  return (
    <Dialog open={currentIndex !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-7xl p-0 border-0 shadow-none bg-transparent overflow-hidden",
          className
        )}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{imageTitle}</DialogTitle>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-0"
          onClick={onClose}
          aria-label="Close lightbox"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Image Container */}
        <div className="relative w-full h-[90vh] flex items-center justify-center">
          {/* Previous Button */}
          {hasPrevious && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-50 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={goToPrevious}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Image */}
          <img
            key={currentIndex}
            src={currentImage}
            alt={imageAlt}
            className="w-full h-full object-contain rounded-lg"
            loading="eager"
          />

          {/* Next Button */}
          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-50 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={goToNext}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/50 text-white text-sm">
            {currentIndex! + 1} / {images.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

