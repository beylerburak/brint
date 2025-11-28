"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { presignUpload, finalizeUpload } from "@/shared/api/media";
import { updateUserProfile } from "@/features/workspace/api/user-api";
import {
  Cropper,
  CropperImage,
  CropperArea,
  type CropperAreaData,
} from "@/components/ui/cropper";

type Props = {
  workspaceSlug: string;
};

export function AvatarUploadDemo({ workspaceSlug }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isCropApplied, setIsCropApplied] = useState(false);
  const [avatarImageSrc, setAvatarImageSrc] = useState<string | null>(null);
  const [cropState, setCropState] = useState({ x: 0, y: 0 });
  const [zoomState, setZoomState] = useState(1);
  const [rotationState, setRotationState] = useState(0);
  const [lastCropArea, setLastCropArea] = useState<CropperAreaData | null>(null);
  const [shouldApplyCrop, setShouldApplyCrop] = useState(false);

  const handleSelectFile = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadFile(null);
    setPreviewUrl(null);
    setIsCropApplied(false);
    setCropState({ x: 0, y: 0 });
    setZoomState(1);
    setRotationState(0);
    
    // Read file as data URL for cropper
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarImageSrc(event.target?.result as string);
    };
    reader.readAsDataURL(file);
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

  const processCrop = useCallback((croppedAreaPixels: CropperAreaData) => {
    if (!avatarImageSrc || !canvasRef.current) return;
    
    const image = new window.Image();
    image.src = avatarImageSrc;
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

    const ctx = canvas.getContext("2d");
      if (!ctx) return;
    
    ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      0,
      0,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
    );
    
    const croppedDataUrl = canvas.toDataURL("image/png");
      
      fetch(croppedDataUrl)
        .then((res) => res.blob())
        .then((blob) => {
    const croppedFile = new File([blob], "avatar-crop.png", { type: "image/png" });
    setUploadFile(croppedFile);
          setPreviewUrl(croppedDataUrl);
    setIsCropApplied(true);
        })
        .catch((error) => {
          console.error("Failed to process cropped image:", error);
          toast({
            title: "Error",
            description: "Failed to process cropped image",
            variant: "destructive",
          });
        });
    };
  }, [avatarImageSrc, toast]);

  const handleCropAreaChange = useCallback((
    croppedAreaPercentages: CropperAreaData,
    croppedAreaPixels: CropperAreaData,
  ) => {
    setLastCropArea(croppedAreaPixels);
    
    if (shouldApplyCrop && croppedAreaPixels) {
      setShouldApplyCrop(false);
      processCrop(croppedAreaPixels);
    }
  }, [shouldApplyCrop, processCrop]);

  const handleCropComplete = useCallback((
    croppedAreaPercentages: CropperAreaData,
    croppedAreaPixels: CropperAreaData,
  ) => {
    setLastCropArea(croppedAreaPixels);
    
    if (shouldApplyCrop) {
      setShouldApplyCrop(false);
      processCrop(croppedAreaPixels);
    }
  }, [shouldApplyCrop, processCrop]);

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

      {avatarImageSrc && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium">Crop</div>
          <div className="relative w-full h-[300px] overflow-hidden rounded-md border bg-muted">
            <Cropper
              aspectRatio={1}
              zoom={zoomState}
              rotation={rotationState}
              crop={cropState}
              onCropChange={setCropState}
              onZoomChange={setZoomState}
              onRotationChange={setRotationState}
              onCropAreaChange={handleCropAreaChange}
              onCropComplete={handleCropComplete}
              minZoom={1}
              maxZoom={3}
              shape="circle"
              withGrid
            >
              <CropperImage src={avatarImageSrc} alt="Crop avatar" />
              <CropperArea />
            </Cropper>
          </div>
              <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCropState({ x: 0, y: 0 });
                setZoomState(1);
                setRotationState(0);
              }}
            >
              Reset
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (lastCropArea) {
                  processCrop(lastCropArea);
                } else {
                  setShouldApplyCrop(true);
                  setCropState((prev) => ({ ...prev }));
                }
              }}
            >
              Apply crop
            </Button>
              </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
}
