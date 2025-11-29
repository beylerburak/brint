"use client";

import { useState, useRef, useCallback } from "react";
import {
  presignUpload,
  finalizeUpload,
  type MediaConfig,
  type PresignUploadResponse,
  type FinalizeUploadResponse,
} from "@/shared/api/media";
import { updateUserProfile } from "@/features/space/api/user-api";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";

interface UseAvatarUploadOptions {
  /** Workspace ID for upload */
  workspaceId?: string;
  /** Media config for validation */
  mediaConfig: MediaConfig | null;
  /** Callback when upload succeeds */
  onSuccess?: (avatarUrl: string, media: FinalizeUploadResponse["media"]) => void;
  /** Callback when upload fails */
  onError?: (error: Error) => void;
}

interface UseAvatarUploadReturn {
  /** Preview URL of the selected/cropped image */
  avatarPreview: string | null;
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
  /** Set avatar preview directly */
  setAvatarPreview: (url: string | null) => void;
}

export function useAvatarUpload(
  options: UseAvatarUploadOptions
): UseAvatarUploadReturn {
  const { workspaceId, mediaConfig, onSuccess, onError } = options;

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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
      // Get avatar config if available
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
        setAvatarPreview(previewUrl);

        // Get presigned URL
        const presign = await presignUpload({
          workspaceId,
          fileName: croppedFile.name,
          contentType: croppedFile.type,
          sizeBytes: croppedFile.size,
          assetType: "avatar",
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
          originalName: croppedFile.name,
          contentType: croppedFile.type,
          assetType: "avatar",
        });

        // Update user profile with new avatar
        const updatedProfile = await updateUserProfile({
          avatarMediaId: finalizeResponse.media.id,
        });

        // Invalidate cache
        apiCache.invalidate("user:profile");
        apiCache.invalidate("session:current");

        // Call success callback
        onSuccess?.(updatedProfile.avatarUrl || previewUrl, finalizeResponse.media);
      } catch (error) {
        logger.error("Avatar upload failed:", error);
        setAvatarPreview(null);
        onError?.(error instanceof Error ? error : new Error("Upload failed"));
      } finally {
        setIsUploading(false);
      }
    },
    [workspaceId, onSuccess, onError]
  );

  const cancelCrop = useCallback(() => {
    setCropDialogOpen(false);
    setSelectedFile(null);
    setImageSrc(null);
  }, []);

  const reset = useCallback(() => {
    setAvatarPreview(null);
    setIsUploading(false);
    setCropDialogOpen(false);
    setSelectedFile(null);
    setImageSrc(null);
  }, []);

  return {
    avatarPreview,
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
    setAvatarPreview,
  };
}
