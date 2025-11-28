"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
  type PixelCrop,
  type ReactCropProps,
} from "react-image-crop";
import { Slot } from "@radix-ui/react-slot";
import { CropIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils";

import "react-image-crop/dist/ReactCrop.css";

const centerAspectCrop = (
  mediaWidth: number,
  mediaHeight: number,
  aspect: number | undefined
): PercentCrop =>
  centerCrop(
    aspect
      ? makeAspectCrop(
          {
            unit: "%",
            width: 90,
          },
          aspect,
          mediaWidth,
          mediaHeight
        )
      : { x: 0, y: 0, width: 90, height: 90, unit: "%" },
    mediaWidth,
    mediaHeight
  );

const percentToPixelCrop = (percentCrop: PercentCrop, mediaWidth: number, mediaHeight: number): PixelCrop => {
  return {
    x: Math.round((percentCrop.x ?? 0) * mediaWidth / 100),
    y: Math.round((percentCrop.y ?? 0) * mediaHeight / 100),
    width: Math.round((percentCrop.width ?? 0) * mediaWidth / 100),
    height: Math.round((percentCrop.height ?? 0) * mediaHeight / 100),
    unit: 'px',
  };
};

const getCroppedPngImage = async (
  imageSrc: HTMLImageElement,
  scaleFactor: number,
  pixelCrop: PixelCrop,
  maxImageSize: number
): Promise<string> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Context is null, this should never happen.");
  }

  // Get the actual rendered dimensions (what ReactCrop sees with object-contain)
  // For object-contain images, we need to use the actual displayed size
  const renderedWidth = imageSrc.offsetWidth || imageSrc.clientWidth || imageSrc.width;
  const renderedHeight = imageSrc.offsetHeight || imageSrc.clientHeight || imageSrc.height;
  const naturalWidth = imageSrc.naturalWidth;
  const naturalHeight = imageSrc.naturalHeight;

  // Calculate scale factors: ReactCrop gives us coordinates in rendered pixels,
  // but we need to map them to natural image pixels
  const scaleX = naturalWidth / renderedWidth;
  const scaleY = naturalHeight / renderedHeight;

  // Calculate the actual crop dimensions in natural image coordinates
  const cropX = Math.round(pixelCrop.x * scaleX);
  const cropY = Math.round(pixelCrop.y * scaleY);
  const cropWidth = Math.round(pixelCrop.width * scaleX);
  const cropHeight = Math.round(pixelCrop.height * scaleY);

  // Set canvas size to the crop dimensions
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the cropped portion of the image
  ctx.drawImage(
    imageSrc,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const croppedImageUrl = canvas.toDataURL("image/png");
  const response = await fetch(croppedImageUrl);
  const blob = await response.blob();

  if (blob.size > maxImageSize) {
    return await getCroppedPngImage(
      imageSrc,
      scaleFactor * 0.9,
      pixelCrop,
      maxImageSize
    );
  }

  return croppedImageUrl;
};

type ImageCropContextType = {
  file: File;
  maxImageSize: number;
  imgSrc: string;
  crop: PercentCrop | undefined;
  completedCrop: PixelCrop | null;
  imgRef: RefObject<HTMLImageElement | null>;
  onCrop?: (croppedImage: string) => void;
  reactCropProps: Omit<ReactCropProps, "onChange" | "onComplete" | "children">;
  handleChange: (pixelCrop: PixelCrop, percentCrop: PercentCrop) => void;
  handleComplete: (
    pixelCrop: PixelCrop,
    percentCrop: PercentCrop
  ) => Promise<void>;
  onImageLoad: (e: SyntheticEvent<HTMLImageElement>) => void;
  applyCrop: () => Promise<void>;
  resetCrop: () => void;
};

const ImageCropContext = createContext<ImageCropContextType | null>(null);

const useImageCrop = () => {
  const context = useContext(ImageCropContext);
  if (!context) {
    throw new Error("ImageCrop components must be used within ImageCrop");
  }
  return context;
};

export type ImageCropProps = {
  file: File;
  maxImageSize?: number;
  onCrop?: (croppedImage: string) => void;
  children: ReactNode;
  onChange?: ReactCropProps["onChange"];
  onComplete?: ReactCropProps["onComplete"];
} & Omit<ReactCropProps, "onChange" | "onComplete" | "children">;

export const ImageCrop = ({
  file,
  maxImageSize = 1024 * 1024 * 5,
  onCrop,
  children,
  onChange,
  onComplete,
  ...reactCropProps
}: ImageCropProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<PercentCrop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [initialCrop, setInitialCrop] = useState<PercentCrop>();

  useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      setImgSrc(reader.result?.toString() || "")
    );
    reader.readAsDataURL(file);
  }, [file]);

  const onImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const newCrop = centerAspectCrop(width, height, reactCropProps.aspect);
      setCrop(newCrop);
      setInitialCrop(newCrop);
      const pixel = percentToPixelCrop(newCrop, width, height);
      setCompletedCrop(pixel);
    },
    [reactCropProps.aspect]
  );

  const handleChange = (pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    setCrop(percentCrop);
    onChange?.(pixelCrop, percentCrop);
  };

  const handleComplete = async (
    pixelCrop: PixelCrop,
    percentCrop: PercentCrop
  ) => {
    setCompletedCrop(pixelCrop);
    onComplete?.(pixelCrop, percentCrop);
  };

  const applyCrop = async () => {
    if (!(imgRef.current && completedCrop)) {
      console.error("Cannot apply crop: missing imgRef or completedCrop", {
        hasImgRef: !!imgRef.current,
        hasCompletedCrop: !!completedCrop,
        completedCrop
      });
      return;
    }

    try {
    const croppedImage = await getCroppedPngImage(
      imgRef.current,
      1,
      completedCrop,
      maxImageSize
    );

    onCrop?.(croppedImage);
    } catch (error) {
      console.error("Error applying crop:", error);
    }
  };

  const resetCrop = () => {
    if (initialCrop) {
      setCrop(initialCrop);
      setCompletedCrop(null);
    }
  };

  const contextValue: ImageCropContextType = {
    file,
    maxImageSize,
    imgSrc,
    crop,
    completedCrop,
    imgRef,
    onCrop,
    reactCropProps,
    handleChange,
    handleComplete,
    onImageLoad,
    applyCrop,
    resetCrop,
  };

  return (
    <ImageCropContext.Provider value={contextValue}>
      {children}
    </ImageCropContext.Provider>
  );
};

export type ImageCropContentProps = {
  style?: CSSProperties;
  className?: string;
};

export const ImageCropContent = ({
  style,
  className,
}: ImageCropContentProps) => {
  const {
    imgSrc,
    crop,
    handleChange,
    handleComplete,
    onImageLoad,
    imgRef,
    reactCropProps,
  } = useImageCrop();

  const shadcnStyle = {
    "--rc-border-color": "var(--color-border)",
    "--rc-focus-color": "var(--color-primary)",
  } as CSSProperties;

  const reactCropClassName = cn(
    // Container'ın tüm yüksekliğini kullan
    "h-full w-full",
    "[&_.ReactCrop__child-wrapper]:flex",
    "[&_.ReactCrop__child-wrapper]:h-full",
    "[&_.ReactCrop__child-wrapper]:w-full",
    "[&_.ReactCrop__child-wrapper]:items-center",
    "[&_.ReactCrop__child-wrapper]:justify-center",
    // img container'ın tüm alanını kullanarak contain olsun
    "[&_.ReactCrop__child-wrapper>img]:h-full",
    "[&_.ReactCrop__child-wrapper>img]:w-full",
    "[&_.ReactCrop__child-wrapper>img]:object-contain",
    "[&_.ReactCrop__child-wrapper>img]:object-center"
  );

  return (
    <div
      className={cn(
        // Container'ın tüm yüksekliğini kullan
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        className
      )}
      style={style}
    >
      <ReactCrop
        className={reactCropClassName}
        crop={crop}
        onChange={handleChange}
        onComplete={handleComplete}
        style={{ ...shadcnStyle, display: "flex", height: "100%", width: "100%" }}
        {...reactCropProps}
      >
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="crop"
            className="block h-full w-full"
            style={{
              objectFit: "contain",
              objectPosition: "center",
            }}
            onLoad={onImageLoad}
            ref={imgRef}
            src={imgSrc}
          />
        )}
      </ReactCrop>
    </div>
  );
};

export type ImageCropApplyProps = ComponentProps<"button"> & {
  asChild?: boolean;
};

export const ImageCropApply = ({
  asChild = false,
  children,
  onClick,
  ...props
}: ImageCropApplyProps) => {
  const { applyCrop } = useImageCrop();

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    await applyCrop();
    onClick?.(e);
  };

  if (asChild) {
    return (
      <Slot onClick={handleClick} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <Button onClick={handleClick} size="icon" variant="ghost" {...props}>
      {children ?? <CropIcon className="size-4" />}
    </Button>
  );
};

export type ImageCropResetProps = ComponentProps<"button"> & {
  asChild?: boolean;
};

export const ImageCropReset = ({
  asChild = false,
  children,
  onClick,
  ...props
}: ImageCropResetProps) => {
  const { resetCrop } = useImageCrop();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    resetCrop();
    onClick?.(e);
  };

  if (asChild) {
    return (
      <Slot onClick={handleClick} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <Button onClick={handleClick} size="icon" variant="ghost" {...props}>
      {children ?? <RotateCcwIcon className="size-4" />}
    </Button>
  );
};

export type CropperProps = Omit<ReactCropProps, "onChange"> & {
  file: File;
  maxImageSize?: number;
  onCrop?: (croppedImage: string) => void;
  onChange?: ReactCropProps["onChange"];
};

export const Cropper = ({
  onChange,
  onComplete,
  onCrop,
  style,
  className,
  file,
  maxImageSize,
  ...props
}: CropperProps) => (
  <ImageCrop
    file={file}
    maxImageSize={maxImageSize}
    onChange={onChange}
    onComplete={onComplete}
    onCrop={onCrop}
    {...props}
  >
    <ImageCropContent className={className} style={style} />
  </ImageCrop>
);