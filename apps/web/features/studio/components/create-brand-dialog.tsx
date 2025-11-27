"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Sparkles, Upload, X, CheckCircle2, XCircle } from "lucide-react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  ImageCrop,
  ImageCropApply,
  ImageCropContent,
  ImageCropReset,
} from "@/components/ui/image-crop";
import { createBrand } from "@/features/studio/api/brand-api";
import { presignUpload, finalizeUpload } from "@/shared/api/media";
import { apiCache } from "@/shared/api/cache";
import { useToast } from "@/components/ui/use-toast";
import { useBrands } from "@/features/studio/hooks/use-brands";
import { cn } from "@/shared/utils";

interface CreateBrandDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateBrandDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateBrandDialogProps) {
  const router = useRouter();
  const locale = useLocale();
  const { workspace, workspaceReady } = useWorkspace();
  const { toast } = useToast();
  const { brands } = useBrands();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isCropApplied, setIsCropApplied] = React.useState(false);
  const [cropDialogOpen, setCropDialogOpen] = React.useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    description: "",
  });

  // Check if slug is available
  const isSlugAvailable = React.useMemo(() => {
    if (!formData.slug.trim()) return null;
    const normalizedSlug = formData.slug.trim().toLowerCase();
    return !brands.some((brand) => brand.slug.toLowerCase() === normalizedSlug);
  }, [formData.slug, brands]);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange || setInternalOpen;

  const defaultTrigger = (
    <Button size="lg" className="gap-2">
      <Sparkles className="size-4" />
      Create Brand
    </Button>
  );

  // Generate slug from name (only if slug hasn't been manually edited)
  React.useEffect(() => {
    if (formData.name && !slugManuallyEdited) {
      const slug = formData.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  }, [formData.name, slugManuallyEdited]);

  const handleFileSelect = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadFile(null);
    setPreviewUrl(null); // Don't set preview until crop is applied
    setIsCropApplied(false);
    setCropDialogOpen(true); // Open crop dialog when file is selected
  };

  const handleCrop = async (croppedDataUrl: string) => {
    const res = await fetch(croppedDataUrl);
    const blob = await res.blob();
    const croppedFile = new File([blob], "brand-logo.png", { type: "image/png" });
    setUploadFile(croppedFile);
    setPreviewUrl(croppedDataUrl);
    setIsCropApplied(true);
    setCropDialogOpen(false); // Close crop dialog after applying crop
  };


  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!workspaceReady || !workspace?.id) return null;

    try {
      const presign = await presignUpload({
        workspaceId: workspace.id,
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
        workspaceId: workspace.id,
        originalName: file.name,
        contentType: file.type,
      });

      return finalize.media.id;
    } catch (error) {
      console.error("Failed to upload logo:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceReady || !workspace?.slug || !workspace?.id) return;

    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({
        title: "Validation error",
        description: "Brand name and slug are required",
        variant: "destructive",
      });
      return;
    }

    if (isSlugAvailable === false) {
      toast({
        title: "Validation error",
        description: "This slug is already taken. Please choose a different one.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload logo first if exists
      let logoMediaId: string | null = null;
      if (uploadFile && isCropApplied) {
        logoMediaId = await uploadLogo(uploadFile);
      }

      // Create brand
      const brand = await createBrand(
        {
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          description: formData.description.trim() || undefined,
          logoMediaId: logoMediaId || undefined,
        },
        workspace.id
      );

      // Invalidate brands cache
      apiCache.invalidate(`brands:${workspace.id}`);

      toast({
        title: "Brand created",
        description: `${brand.name} has been created successfully`,
      });

      // Reset form
      setFormData({ name: "", slug: "", description: "" });
      setSelectedFile(null);
      setUploadFile(null);
      setPreviewUrl(null);
      setIsCropApplied(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }

      // Close dialog
      onOpenChange(false);

      // Navigate to brand dashboard
      router.push(`/${locale}/${workspace.slug}/studio/${brand.slug}/dashboard`);
    } catch (error) {
      console.error("Failed to create brand:", error);
      toast({
        title: "Failed to create brand",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLogo = () => {
    setSelectedFile(null);
    setUploadFile(null);
    setPreviewUrl(null);
    setIsCropApplied(false);
    setCropDialogOpen(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Validate slug before submit
  const canSubmit = formData.name.trim() && formData.slug.trim() && isSlugAvailable === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="w-[60vw] h-[80vh] max-w-[60vw] max-h-[80vh] sm:max-w-[60vw] sm:max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Brand</DialogTitle>
          <DialogDescription>
            Create a new brand for your workspace. Add a logo, name, and description to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 h-full">
          <FieldSet className="flex-1 flex flex-col">
            <FieldGroup className="flex-1 flex flex-col">
              {/* Logo Upload Section */}
              <Field>
                <FieldLabel>Brand Logo</FieldLabel>
                <FieldContent>
                  <div className="flex items-center gap-4">
                    <div className="flex size-20 items-center justify-center rounded-lg border-2 border-dashed bg-muted overflow-hidden">
                      {previewUrl && isCropApplied ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="Brand logo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Upload className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!isCropApplied ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleFileSelect}
                            disabled={isSubmitting}
                            className="w-fit"
                          >
                            <Upload className="size-4" />
                            Upload Logo
                          </Button>
                          <FieldDescription>
                            Recommended: Square image, at least 256x256px
                          </FieldDescription>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setCropDialogOpen(true)}
                            disabled={isSubmitting}
                            className="w-fit h-auto p-0"
                          >
                            Edit Crop
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemoveLogo}
                            disabled={isSubmitting}
                            className="w-fit"
                          >
                            <X className="size-4" />
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </FieldContent>
              </Field>

              {/* Form Fields - 2 Column Layout */}
              <div className="flex flex-1 gap-6">
                {/* Left Column: Name and Slug */}
                <div className="flex-1 flex flex-col gap-4">
                  <Field>
                    <FieldLabel htmlFor="name">
                      Brand Name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="name"
                        placeholder="My Brand"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="slug">
                      Brand Slug <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <InputGroup
                        className={formData.slug.trim() && isSlugAvailable !== null 
                          ? (isSlugAvailable ? "border-green-500 has-[[data-slot=input-group-control]:focus-visible]:border-green-500" : "border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive")
                          : ""
                        }
                      >
                        <InputGroupAddon align="inline-start">
                          <span>@</span>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="slug"
                          placeholder="my-brand"
                          value={formData.slug}
                          onChange={(e) => {
                            setSlugManuallyEdited(true);
                            setFormData({ ...formData, slug: e.target.value });
                          }}
                          required
                          disabled={isSubmitting}
                        />
                      </InputGroup>
                      {formData.slug.trim() && isSlugAvailable !== null && (
                        <FieldDescription className={isSlugAvailable ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                          <span className="inline-flex items-center gap-1.5">
                            {isSlugAvailable ? (
                              <>
                                <CheckCircle2 className="size-4" />
                                <span>This slug is available</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="size-4" />
                                <span>This slug is already taken</span>
                              </>
                            )}
                          </span>
                        </FieldDescription>
                      )}
                      {(!formData.slug.trim() || isSlugAvailable === null) && (
                        <FieldDescription>
                          Used in URLs. Lowercase letters, numbers, and hyphens only.
                        </FieldDescription>
                      )}
                    </FieldContent>
                  </Field>
                </div>

                {/* Right Column: Description */}
                <div className="flex-1 flex flex-col">
                  <Field className="flex-1">
                    <FieldLabel htmlFor="description">Description (Optional)</FieldLabel>
                    <FieldContent className="flex-1">
                      <Textarea
                        id="description"
                        placeholder="A brief description of your brand..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="flex-1 h-full"
                        disabled={isSubmitting}
                      />
                    </FieldContent>
                  </Field>
                </div>
              </div>
            </FieldGroup>
          </FieldSet>

          <DialogFooter className="mt-auto border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Creating..." : "Create Brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Crop Dialog */}
      <Dialog 
        open={cropDialogOpen} 
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          // If dialog is closed without applying crop, reset file selection
          if (!open && !isCropApplied) {
            setSelectedFile(null);
            setPreviewUrl(null);
            setUploadFile(null);
            if (inputRef.current) {
              inputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Logo</DialogTitle>
            <DialogDescription>
              Adjust the crop area for your brand logo. The image will be cropped to a square.
            </DialogDescription>
          </DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <ImageCrop
                file={selectedFile}
                aspect={1}
                onCrop={handleCrop}
              >
                <div className="space-y-4">
                  <ImageCropContent className="rounded-md border" />
                  <div className="flex gap-2 justify-end">
                    <ImageCropReset asChild>
                      <Button type="button" size="sm" variant="ghost">
                        Reset
                      </Button>
                    </ImageCropReset>
                    <ImageCropApply asChild>
                      <Button type="button" size="sm" variant="default">
                        Apply crop
                      </Button>
                    </ImageCropApply>
                  </div>
                </div>
              </ImageCrop>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
