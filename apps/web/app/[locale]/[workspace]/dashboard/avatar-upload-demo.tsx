"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { presignUpload, finalizeUpload } from "@/shared/api/media";
import { updateUserProfile } from "@/features/workspace/api/user-api";
import {
  ImageCrop,
  ImageCropApply,
  ImageCropContent,
  ImageCropReset,
} from "@/components/ui/image-crop";
import type { PixelCrop } from "react-image-crop";

type Props = {
  workspaceSlug: string;
};

export function AvatarUploadDemo({ workspaceSlug }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isCropApplied, setIsCropApplied] = useState(false);

  const handleSelectFile = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadFile(null); // Reset upload file - will be set when crop is applied
    setPreviewUrl(URL.createObjectURL(file));
    setIsCropApplied(false);
  };

  const uploadAvatar = async (file: File) => {
    setIsUploading(true);
    try {
      const presign = await presignUpload({
        workspaceId: workspaceSlug,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      const finalize = await finalizeUpload({
        objectKey: presign.objectKey,
        workspaceId: workspaceSlug,
        originalName: file.name,
        contentType: file.type,
      });

      const updated = await updateUserProfile({ avatarMediaId: finalize.media.id });

      setPreviewUrl(updated.avatarUrl ?? null);
      toast({
        title: "Avatar updated",
        description: "New avatar saved successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload avatar",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = () => {
    if (!uploadFile) {
      toast({ title: "No file selected", description: "Please choose a file first", variant: "destructive" });
      return;
    }
    void uploadAvatar(uploadFile);
  };

  const handleCrop = async (croppedDataUrl: string) => {
    const res = await fetch(croppedDataUrl);
    const blob = await res.blob();
    const croppedFile = new File([blob], "avatar-crop.png", { type: "image/png" });
    setUploadFile(croppedFile);
    setPreviewUrl(croppedDataUrl);
    setIsCropApplied(true);
  };

  // Auto-apply crop when crop area changes
  const applyCropToFile = useCallback(async (pixelCrop: PixelCrop) => {
    if (!selectedFile) return;
    
    const img = new Image();
    img.src = URL.createObjectURL(selectedFile);
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(img.src);
      return;
    }
    
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    
    ctx.drawImage(
      img,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    
    const croppedDataUrl = canvas.toDataURL("image/png");
    const res = await fetch(croppedDataUrl);
    const blob = await res.blob();
    const croppedFile = new File([blob], "avatar-crop.png", { type: "image/png" });
    setUploadFile(croppedFile);
    setIsCropApplied(true);
    
    URL.revokeObjectURL(img.src);
  }, [selectedFile]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="size-12 overflow-hidden rounded-full bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">No avatar</div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">Avatar demo</span>
          <span className="text-xs text-muted-foreground">Upload and set as user avatar</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSelectFile} disabled={isUploading}>
          Select file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button 
          size="sm" 
          onClick={handleUploadClick} 
          disabled={isUploading || !uploadFile || !isCropApplied}
        >
          {isUploading ? "Uploading..." : "Upload avatar"}
        </Button>
      </div>

      {selectedFile && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium">Crop</div>
          <ImageCrop 
            file={selectedFile} 
            aspect={1} 
            onCrop={handleCrop}
            onComplete={async (pixelCrop) => {
              // Auto-apply crop when crop area changes (for upload)
              await applyCropToFile(pixelCrop);
            }}
          >
            <div className="space-y-2">
              <ImageCropContent className="rounded-md border" />
              <div className="flex gap-2">
                <ImageCropApply asChild>
                  <Button size="sm" variant="secondary">Apply crop</Button>
                </ImageCropApply>
                <ImageCropReset asChild>
                  <Button size="sm" variant="ghost">Reset</Button>
                </ImageCropReset>
              </div>
            </div>
          </ImageCrop>
        </div>
      )}
    </div>
  );
}
