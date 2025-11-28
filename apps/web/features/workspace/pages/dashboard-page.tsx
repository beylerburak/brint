"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PermissionGate, PERMISSIONS } from "@/permissions";
import { AvatarUploadDemo } from "@/app/[locale]/[workspace]/dashboard/avatar-upload-demo"; // TODO: Move to features/workspace/components when refactoring
import {
  Cropper,
  CropperImage,
  CropperArea,
  useCropper,
  type CropperAreaData,
} from "@/components/ui/cropper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DashboardPageProps {
  workspace: string;
}

function CropperDemo() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
        setCroppedImage(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (
    croppedAreaPercentages: CropperAreaData,
    croppedAreaPixels: CropperAreaData,
  ) => {
    if (!imageSrc || !canvasRef.current) return;

    const image = new window.Image();
    image.src = imageSrc;
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

      setCroppedImage(canvas.toDataURL("image/png"));
    };
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-6">
      <div>
        <h3 className="text-lg font-semibold">Image Cropper Demo</h3>
        <p className="text-sm text-muted-foreground">
          Select an image and crop it using the cropper below
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="image-upload">Select Image</Label>
        <Input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          ref={fileInputRef}
        />
      </div>

      {imageSrc && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Cropper (drag to move, scroll to zoom, arrow keys to adjust)</Label>
            <div className="relative h-[400px] w-full overflow-hidden rounded-lg border bg-muted">
              <Cropper
                aspectRatio={1}
                zoom={zoom}
                rotation={rotation}
                crop={crop}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={handleCropComplete}
                minZoom={1}
                maxZoom={3}
                shape="rectangle"
                withGrid
              >
                <CropperImage src={imageSrc} alt="Crop me" />
                <CropperArea />
              </Cropper>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Controls</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.max(1, zoom - 0.1))}
              >
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              >
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation((rotation - 90) % 360)}
              >
                Rotate Left
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation((rotation + 90) % 360)}
              >
                Rotate Right
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                  setRotation(0);
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {croppedImage && (
            <div className="flex flex-col gap-2">
              <Label>Cropped Result</Label>
              <div className="flex items-center justify-center rounded-lg border bg-muted p-4">
                <img
                  src={croppedImage}
                  alt="Cropped"
                  className="max-h-[300px] max-w-full rounded"
                />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
}

export function WorkspaceDashboardPage({ workspace }: DashboardPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Workspace slug: <span className="font-semibold">{workspace}</span>
        </p>
      </div>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <div className="p-6">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-semibold">Welcome</h2>
              <p className="text-muted-foreground mt-1">
                This is your dashboard workspace.
              </p>
            </div>
            <Button>Sample Button</Button>
            <PermissionGate permission={PERMISSIONS.WORKSPACE_MEMBERS_MANAGE}>
              <AvatarUploadDemo workspaceSlug={workspace} />
            </PermissionGate>
            <CropperDemo />
            <DataTable data={[]} />
          </div>
        </div>
      </div>
    </div>
  );
}
