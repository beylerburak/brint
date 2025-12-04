"use client"

import * as React from "react"
import Cropper, { type Area, type Point } from "react-easy-crop"
import { cn } from "@/lib/utils"

interface CropperContextValue {
  crop: Point
  zoom: number
  rotation: number
  aspect: number
  onCropChange: (crop: Point) => void
  onZoomChange: (zoom: number) => void
  onRotationChange: (rotation: number) => void
  onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void
}

const CropperContext = React.createContext<CropperContextValue | null>(null)

function useCropperContext() {
  const context = React.useContext(CropperContext)
  if (!context) {
    throw new Error("Cropper components must be used within a Cropper")
  }
  return context
}

interface CropperRootProps {
  children: React.ReactNode
  defaultCrop?: Point
  defaultZoom?: number
  defaultRotation?: number
  aspect?: number
  onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void
  className?: string
}

export function CropperRoot({
  children,
  defaultCrop = { x: 0, y: 0 },
  defaultZoom = 1,
  defaultRotation = 0,
  aspect = 1,
  onCropComplete,
  className,
}: CropperRootProps) {
  const [crop, setCrop] = React.useState<Point>(defaultCrop)
  const [zoom, setZoom] = React.useState(defaultZoom)
  const [rotation, setRotation] = React.useState(defaultRotation)

  return (
    <CropperContext.Provider
      value={{
        crop,
        zoom,
        rotation,
        aspect,
        onCropChange: setCrop,
        onZoomChange: setZoom,
        onRotationChange: setRotation,
        onCropComplete,
      }}
    >
      <div className={cn("relative w-full h-full", className)}>
        {children}
      </div>
    </CropperContext.Provider>
  )
}

interface CropperImageProps {
  src: string
  alt?: string
  cropShape?: "rect" | "round"
  showGrid?: boolean
  minZoom?: number
  maxZoom?: number
  className?: string
}

export function CropperImage({
  src,
  alt = "Image to crop",
  cropShape = "rect",
  showGrid = true,
  minZoom = 1,
  maxZoom = 3,
  className,
}: CropperImageProps) {
  const {
    crop,
    zoom,
    rotation,
    aspect,
    onCropChange,
    onZoomChange,
    onRotationChange,
    onCropComplete,
  } = useCropperContext()

  return (
    <div className={cn("relative w-full h-full min-h-[400px]", className)}>
      <Cropper
        image={src}
        crop={crop}
        zoom={zoom}
        rotation={rotation}
        aspect={aspect}
        onCropChange={onCropChange}
        onZoomChange={onZoomChange}
        onRotationChange={onRotationChange}
        onCropComplete={onCropComplete}
        cropShape={cropShape}
        showGrid={showGrid}
        minZoom={minZoom}
        maxZoom={maxZoom}
      />
    </div>
  )
}

interface CropperControlsProps {
  onCancel?: () => void
  onCrop?: () => void
  children?: React.ReactNode
  className?: string
}

export function CropperControls({
  onCancel,
  onCrop,
  children,
  className,
}: CropperControlsProps) {
  const { zoom, rotation, onZoomChange, onRotationChange } = useCropperContext()

  return (
    <div className={cn("flex flex-col gap-4 p-4", className)}>
      {children}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border rounded-md hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={onCrop}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Crop
        </button>
      </div>
    </div>
  )
}

// Export named exports
export { CropperRoot as Cropper }
export type { CropperRootProps, CropperImageProps, CropperControlsProps }

