"use client";

import { useState, useRef, useCallback } from "react";
import {
  presignUpload,
  finalizeUpload,
  type MediaConfig,
  type FinalizeUploadResponse,
} from "@/shared/api/media";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";

interface UseBrandLogoUploadOptions {
  /** Workspace ID for upload */
  workspaceId?: string;
  /** Brand ID for the logo */
  brandId?: string;
  /** Media config for validation */
  mediaConfig: MediaConfig | null;
  /** Callback when upload succeeds - returns mediaId and media object */
  onSuccess?: (mediaId: string, media: FinalizeUploadResponse["media"]) => void;
  /** Callback when upload fails */
  onError?: (error: Error) => void;
}

interface UseBrandLogoUploadReturn {
  /** Preview URL of the selected/cropped image */
  logoPreview: string | null;
  /** Is upload in progress? */
  isUploading: boolean;
  /** Is crop dialog open? */
  cropDialogOpen: boolean;
  /** Selected file for cropping */
  selectedFile: File | null;
  /** Image source URL for cropper */
  imageSrc: string | null;
  /** Open file picker */
  openFilePicker: () => void;
  /** Handle file selection */
  handleFileSelect: (file: File) => void;
  /** Handle crop completion with cropped file */
  handleCropComplete: (croppedFile: File) => Promise<void>;
  /** Cancel crop and close dialog */
  cancelCrop: () => void;
  /** Reset all state */
  reset: () => void;
  /** File input ref for external control */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Set crop dialog open state */
  setCropDialogOpen: (open: boolean) => void;
  /** Set logo preview directly */
  setLogoPreview: (url: string | null) => void;
}

export function useBrandLogoUpload(
  options: UseBrandLogoUploadOptions
): UseBrandLogoUploadReturn {
  const { workspaceId, brandId, mediaConfig, onSuccess, onError } = options;

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      // Get avatar config (we'll use avatar limits for brand logos too)
      const avatarConfig = mediaConfig?.assets?.avatar;

      // Validate file type
      const allowedTypes = avatarConfig?.limits?.allowedMimeTypes ?? [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        onError?.(new Error(`File type ${file.type} is not allowed`));
        return;
      }

      // Validate file size
      const maxSize = avatarConfig?.limits?.maxFileSizeBytes ?? 5 * 1024 * 1024; // 5MB default
      if (file.size > maxSize) {
        onError?.(
          new Error(
            `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`
          )
        );
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    },
    [mediaConfig, onError]
  );

  const handleCropComplete = useCallback(
    async (croppedFile: File) => {
      if (!workspaceId) {
        onError?.(new Error("Workspace ID is required"));
        return;
      }

      setCropDialogOpen(false);
      setIsUploading(true);

      try {
        // Create preview
        const previewUrl = URL.createObjectURL(croppedFile);
        setLogoPreview(previewUrl);

        // Get presigned URL
        const presign = await presignUpload({
          workspaceId,
          brandId,
          fileName: croppedFile.name,
          contentType: croppedFile.type,
          sizeBytes: croppedFile.size,
          assetType: "avatar", // Using avatar asset type for logos
        });

        // Upload to S3
        await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": croppedFile.type,
          },
          body: croppedFile,
        });

        // Finalize upload
        const finalizeResponse = await finalizeUpload({
          objectKey: presign.objectKey,
          workspaceId,
          brandId,
          originalName: croppedFile.name,
          contentType: croppedFile.type,
          assetType: "avatar",
        });

        // Invalidate brand cache
        if (brandId) {
          apiCache.invalidate(`brand:${brandId}`);
          apiCache.invalidate("brands:list");
        }

        // Call success callback with mediaId
        onSuccess?.(finalizeResponse.media.id, finalizeResponse.media);
      } catch (error) {
        logger.error("Brand logo upload failed:", error);
        setLogoPreview(null);
        onError?.(error instanceof Error ? error : new Error("Upload failed"));
      } finally {
        setIsUploading(false);
      }
    },
    [workspaceId, brandId, onSuccess, onError]
  );

  const cancelCrop = useCallback(() => {
    setCropDialogOpen(false);
    setSelectedFile(null);
    setImageSrc(null);
  }, []);

  const reset = useCallback(() => {
    setLogoPreview(null);
    setIsUploading(false);
    setCropDialogOpen(false);
    setSelectedFile(null);
    setImageSrc(null);
  }, []);

  return {
    logoPreview,
    isUploading,
    cropDialogOpen,
    selectedFile,
    imageSrc,
    openFilePicker,
    handleFileSelect,
    handleCropComplete,
    cancelCrop,
    reset,
    fileInputRef,
    setCropDialogOpen,
    setLogoPreview,
  };
}

