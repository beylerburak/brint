"use client";

/**
 * Brand Wizard
 * 
 * Multi-step wizard for creating and editing brands.
 * Steps:
 * 1. Basic Info (name, slug, description, industry, language, timezone)
 * 2. Identity (logo, websiteUrl, toneOfVoice, primaryColor, secondaryColor)
 * 3. Publishing & Hashtags (hashtag presets management)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Check, Loader2, Upload, Briefcase, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerSwatch,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Cropper,
  CropperImage,
  CropperArea,
  type CropperAreaData,
} from "@/components/ui/cropper";
import { cn } from "@/shared/utils";
import { useCreateBrand, useUpdateBrand } from "../hooks";
import { useBrand } from "../hooks/use-brand";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useToast } from "@/components/ui/use-toast";
import { BrandReadinessPanel } from "./brand-readiness-panel";
import { HashtagPresetsPanel } from "./hashtag-presets-panel";
import { getMediaConfig, presignUpload, finalizeUpload, type MediaConfig } from "@/shared/api/media";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";
import type { BrandSummary, BrandDetail, CreateBrandRequest, UpdateBrandRequest } from "../types";

// ============================================================================
// Form Schemas
// ============================================================================

const basicInfoSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  industry: z.string().max(255).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(100).optional(),
});

const identitySchema = z.object({
  websiteUrl: z.string().url("Please enter a valid URL").max(2000).optional().or(z.literal("")),
  toneOfVoice: z.string().max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use hex format (#RRGGBB)").optional().or(z.literal("")),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use hex format (#RRGGBB)").optional().or(z.literal("")),
});

type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
type IdentityFormData = z.infer<typeof identitySchema>;

// ============================================================================
// Constants
// ============================================================================

const LANGUAGES = [
  { value: "tr", label: "Turkish" },
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

const TIMEZONES = [
  { value: "Europe/Istanbul", label: "Istanbul (GMT+3)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (GMT+1)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
];

const INDUSTRIES = [
  "Technology",
  "E-commerce",
  "Fashion",
  "Food & Beverage",
  "Health & Wellness",
  "Education",
  "Finance",
  "Real Estate",
  "Travel",
  "Entertainment",
  "Other",
];

const TONES = [
  { value: "friendly", label: "Friendly & Casual" },
  { value: "professional", label: "Professional" },
  { value: "corporate", label: "Corporate & Formal" },
  { value: "playful", label: "Playful & Fun" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
];

// Turkish character map for slugify
const TR_CHAR_MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'c',
  'ğ': 'g', 'Ğ': 'g',
  'ı': 'i', 'İ': 'i',
  'ö': 'o', 'Ö': 'o',
  'ş': 's', 'Ş': 's',
  'ü': 'u', 'Ü': 'u',
};

/**
 * Client-side slugify function
 */
function slugify(text: string): string {
  let slug = text.toLowerCase();
  
  // Replace Turkish characters
  for (const [turkishChar, asciiChar] of Object.entries(TR_CHAR_MAP)) {
    slug = slug.replace(new RegExp(turkishChar, 'g'), asciiChar);
  }
  
  // Replace non-alphanumeric characters with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  
  // Remove consecutive hyphens
  slug = slug.replace(/-+/g, '-');
  
  // Remove leading/trailing hyphens
  slug = slug.replace(/^-|-$/g, '');
  
  return slug;
}

// ============================================================================
// Component
// ============================================================================

interface BrandWizardProps {
  open: boolean;
  brand: BrandSummary | null; // If provided, wizard is in edit mode
  onClose: () => void;
  onSuccess: () => void;
}

export function BrandWizard({ open, brand, onClose, onSuccess }: BrandWizardProps) {
  const [step, setStep] = useState(1);
  const [createdBrandId, setCreatedBrandId] = useState<string | null>(brand?.id || null);
  
  // Hooks for mutations
  const { createBrand, loading: createLoading } = useCreateBrand();
  const { updateBrand, loading: updateLoading } = useUpdateBrand(createdBrandId || "");
  
  // Fetch full brand details if editing
  const { brand: brandDetail, refresh: refreshBrand } = useBrand(createdBrandId);

  const isEditing = !!brand;
  const isCreating = !brand && !createdBrandId;
  const loading = createLoading || updateLoading;

  // Reset state when wizard opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setCreatedBrandId(brand?.id || null);
    }
  }, [open, brand?.id]);

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const stepTitles = [
    { title: "Basic Info", description: "Name and basic details" },
    { title: "Identity", description: "Branding and appearance" },
    { title: "Hashtags", description: "Hashtag presets" },
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4">
        <SheetHeader className="space-y-1">
          <SheetTitle>
            {isCreating ? "Create Brand" : `Edit ${brand?.name || "Brand"}`}
          </SheetTitle>
          <SheetDescription>
            {stepTitles[step - 1].description}
          </SheetDescription>
        </SheetHeader>

        {/* Progress indicator */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {step} of {totalSteps}</span>
            <span>{stepTitles[step - 1].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Readiness panel (shown after brand is created) */}
        {brandDetail && (
          <div className="mt-6 rounded-lg border bg-muted/50 p-4">
            <BrandReadinessPanel
              data={{
                readinessScore: brandDetail.readinessScore,
                profileCompleted: brandDetail.profileCompleted,
                hasAtLeastOneSocialAccount: brandDetail.hasAtLeastOneSocialAccount,
                publishingDefaultsConfigured: brandDetail.publishingDefaultsConfigured,
              }}
              variant="full"
            />
          </div>
        )}

        {/* Step content */}
        <div className="mt-6">
          {step === 1 && (
            <BasicInfoStep
              brand={brandDetail || brand}
              loading={loading}
              isCreating={isCreating}
              onSubmit={async (data) => {
                if (isCreating) {
                  const result = await createBrand(data as CreateBrandRequest);
                  if (result) {
                    setCreatedBrandId(result.id);
                    setStep(2);
                  }
                } else {
                  const result = await updateBrand(data as UpdateBrandRequest);
                  if (result) {
                    refreshBrand();
                    setStep(2);
                  }
                }
              }}
              onCancel={onClose}
            />
          )}

          {step === 2 && (
            <IdentityStep
              brand={brandDetail}
              brandId={createdBrandId}
              loading={loading}
              onSubmit={async (data) => {
                const result = await updateBrand(data as UpdateBrandRequest);
                if (result) {
                  refreshBrand();
                  setStep(3);
                }
              }}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && createdBrandId && (
            <HashtagStep
              brandId={createdBrandId}
              onBack={() => setStep(2)}
              onFinish={onSuccess}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// Step 1: Basic Info
// ============================================================================

interface BasicInfoStepProps {
  brand: BrandSummary | BrandDetail | null;
  loading: boolean;
  isCreating: boolean;
  onSubmit: (data: BasicInfoFormData) => Promise<void>;
  onCancel: () => void;
}

function BasicInfoStep({ brand, loading, isCreating, onSubmit, onCancel }: BasicInfoStepProps) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  
  const form = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: brand?.name || "",
      slug: brand?.slug || "",
      description: brand?.description || "",
      industry: brand?.industry || "",
      language: brand?.language || "",
      timezone: brand?.timezone || "",
    },
  });

  // Reset form when brand data changes (e.g., when editing)
  useEffect(() => {
    if (brand) {
      form.reset({
        name: brand.name || "",
        slug: brand.slug || "",
        description: brand.description || "",
        industry: brand.industry || "",
        language: brand.language || "",
        timezone: brand.timezone || "",
      });
      // If brand has a slug, mark as manually edited to prevent auto-generation
      if (brand.slug) {
        setSlugManuallyEdited(true);
      }
    }
  }, [brand, form]);

  // Watch name field for auto-slug generation
  const nameValue = useWatch({ control: form.control, name: "name" });

  // Auto-generate slug from name (only if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && nameValue) {
      const generatedSlug = slugify(nameValue);
      form.setValue("slug", generatedSlug, { shouldValidate: false });
    }
  }, [nameValue, slugManuallyEdited, form]);

  // Handle manual slug edit
  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    form.setValue("slug", e.target.value);
  }, [form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand Name *</FormLabel>
              <FormControl>
                <Input placeholder="My Awesome Brand" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input 
                  placeholder="my-awesome-brand" 
                  {...field}
                  onChange={(e) => {
                    handleSlugChange(e);
                    field.onChange(e);
                  }}
                />
              </FormControl>
              <FormDescription>
                URL-friendly identifier. Auto-generated from name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief description of your brand..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Industry</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreating ? "Create & Continue" : "Save & Continue"}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ============================================================================
// Step 2: Identity
// ============================================================================

interface IdentityStepProps {
  brand: BrandDetail | null;
  brandId: string | null;
  loading: boolean;
  onSubmit: (data: IdentityFormData & { logoMediaId?: string | null }) => Promise<void>;
  onBack: () => void;
}

function IdentityStep({ brand, brandId, loading, onSubmit, onBack }: IdentityStepProps) {
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  
  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(brand?.logoUrl || null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoMediaId, setLogoMediaId] = useState<string | null>(brand?.logoMediaId || null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null); // File waiting to be uploaded on save
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [logoImageSrc, setLogoImageSrc] = useState<string | null>(null);
  const [mediaConfig, setMediaConfig] = useState<MediaConfig | null>(null);
  const [cropState, setCropState] = useState({ x: 0, y: 0 });
  const [zoomState, setZoomState] = useState(1);
  const [rotationState, setRotationState] = useState(0);
  const [lastCropArea, setLastCropArea] = useState<CropperAreaData | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const form = useForm<IdentityFormData>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      websiteUrl: brand?.websiteUrl || "",
      toneOfVoice: brand?.toneOfVoice || "",
      primaryColor: brand?.primaryColor || "",
      secondaryColor: brand?.secondaryColor || "",
    },
  });

  // Load media config on mount
  useEffect(() => {
    const loadMediaConfig = async () => {
      try {
        const cachedConfig = apiCache.get<MediaConfig>("media:config", 300000);
        if (cachedConfig) {
          setMediaConfig(cachedConfig);
          return;
        }
        const config = await getMediaConfig();
        setMediaConfig(config);
      } catch (error) {
        logger.error("Failed to load media config:", error);
      }
    };
    loadMediaConfig();
  }, []);

  // Reset form and logo when brand data changes
  useEffect(() => {
    if (brand) {
      form.reset({
        websiteUrl: brand.websiteUrl || "",
        toneOfVoice: brand.toneOfVoice || "",
        primaryColor: brand.primaryColor || "",
        secondaryColor: brand.secondaryColor || "",
      });
      setLogoPreview(brand.logoUrl || null);
      setLogoMediaId(brand.logoMediaId || null);
    }
  }, [brand, form]);

  // Handle logo file selection
  const handleLogoFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const avatarConfig = mediaConfig?.assets?.avatar;
    const allowedTypes = avatarConfig?.limits?.allowedMimeTypes ?? [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Only ${allowedTypes.join(", ")} are allowed`,
        variant: "destructive",
      });
      return;
    }

    const maxSize = avatarConfig?.limits?.maxFileSizeBytes ?? 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `File size must be under ${Math.round(maxSize / 1024 / 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoImageSrc(reader.result as string);
      setCropState({ x: 0, y: 0 });
      setZoomState(1);
      setRotationState(0);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  }, [mediaConfig, toast]);

  // Handle crop area change
  const handleCropAreaChange = useCallback((_: unknown, croppedAreaPixels: CropperAreaData) => {
    setLastCropArea(croppedAreaPixels);
  }, []);

  // Process crop - just create preview, don't upload yet
  const processCrop = useCallback(async (cropArea: CropperAreaData) => {
    if (!logoImageSrc || !canvasRef.current) return;

    const image = new Image();
    image.src = logoImageSrc;

    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
    });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to crop area size (max 512px)
    const outputSize = Math.min(cropArea.width, 512);
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Draw cropped image
    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      outputSize,
      outputSize
    );

    // Convert to blob and show preview (don't upload yet)
    canvas.toBlob((blob) => {
      if (!blob) return;

      const croppedFile = new File([blob], "brand-logo.png", { type: "image/png" });
      
      // Create preview URL from blob
      const previewUrl = URL.createObjectURL(croppedFile);
      setLogoPreview(previewUrl);
      
      // Store file for later upload on save
      setPendingLogoFile(croppedFile);
      
      // Clear the existing logoMediaId since we have a new pending file
      setLogoMediaId(null);
      
      setCropDialogOpen(false);
      
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
    }, "image/png", 0.9);
  }, [logoImageSrc]);

  // Remove logo
  const handleRemoveLogo = useCallback(() => {
    setLogoPreview(null);
    setLogoMediaId(null);
    setPendingLogoFile(null);
  }, []);

  // Upload pending file to S3
  const uploadPendingLogo = useCallback(async (): Promise<string | null> => {
    if (!pendingLogoFile || !workspace?.id) return null;

    const presign = await presignUpload({
      workspaceId: workspace.id,
      brandId: brandId || undefined,
      fileName: pendingLogoFile.name,
      contentType: pendingLogoFile.type,
      sizeBytes: pendingLogoFile.size,
      assetType: "avatar",
    });

    await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": pendingLogoFile.type },
      body: pendingLogoFile,
    });

    const finalizeResponse = await finalizeUpload({
      objectKey: presign.objectKey,
      workspaceId: workspace.id,
      brandId: brandId || undefined,
      originalName: pendingLogoFile.name,
      contentType: pendingLogoFile.type,
      assetType: "avatar",
    });

    return finalizeResponse.media.id;
  }, [pendingLogoFile, workspace?.id, brandId]);

  // Submit with logo - upload pending file first if exists
  const handleSubmit = useCallback(async (data: IdentityFormData) => {
    setIsUploadingLogo(true);
    
    try {
      let finalLogoMediaId = logoMediaId;
      
      // Upload pending logo if exists
      if (pendingLogoFile) {
        finalLogoMediaId = await uploadPendingLogo();
        setPendingLogoFile(null);
        setLogoMediaId(finalLogoMediaId);
      }
      
      await onSubmit({
        ...data,
        logoMediaId: finalLogoMediaId,
      });
    } catch (error) {
      logger.error("Failed to save identity:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save brand identity",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  }, [onSubmit, logoMediaId, pendingLogoFile, uploadPendingLogo, toast]);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Brand Logo</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className={cn(
                  "h-20 w-20 rounded-lg border-2",
                  pendingLogoFile 
                    ? "border-dashed border-primary" 
                    : "border-dashed border-muted-foreground/25"
                )}>
                  {logoPreview ? (
                    <AvatarImage src={logoPreview} alt="Brand logo" className="object-cover" />
                  ) : (
                    <AvatarFallback className="rounded-lg bg-muted">
                      <Briefcase className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                {isUploadingLogo && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                {pendingLogoFile && !isUploadingLogo && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" title="Pending upload" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {logoPreview ? "Change" : "Upload"}
                  </Button>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingLogoFile 
                    ? "Logo will be uploaded when you save" 
                    : "JPG, PNG or GIF. Max 5MB."}
                </p>
              </div>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleLogoFileChange}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="websiteUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="toneOfVoice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tone of Voice</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TONES.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  This helps AI generate content that matches your brand voice.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Color</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value || "#3B82F6"}
                      onValueChange={field.onChange}
                    >
                      <ColorPickerTrigger className="h-9 w-full justify-start rounded-md border border-input bg-transparent px-3 py-1 shadow-xs hover:bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]">
                        <ColorPickerSwatch className="h-5 w-5 rounded" />
                        <span className="ml-2 font-mono text-sm text-foreground">
                          {field.value || "Select color"}
                        </span>
                      </ColorPickerTrigger>
                      <ColorPickerContent>
                        <ColorPickerArea />
                        <div className="flex items-center gap-2">
                          <ColorPickerEyeDropper />
                          <ColorPickerHueSlider className="flex-1" />
                        </div>
                        <ColorPickerInput />
                      </ColorPickerContent>
                    </ColorPicker>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secondaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Color</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value || "#10B981"}
                      onValueChange={field.onChange}
                    >
                      <ColorPickerTrigger className="h-9 w-full justify-start rounded-md border border-input bg-transparent px-3 py-1 shadow-xs hover:bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]">
                        <ColorPickerSwatch className="h-5 w-5 rounded" />
                        <span className="ml-2 font-mono text-sm text-foreground">
                          {field.value || "Select color"}
                        </span>
                      </ColorPickerTrigger>
                      <ColorPickerContent>
                        <ColorPickerArea />
                        <div className="flex items-center gap-2">
                          <ColorPickerEyeDropper />
                          <ColorPickerHueSlider className="flex-1" />
                        </div>
                        <ColorPickerInput />
                      </ColorPickerContent>
                    </ColorPicker>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button type="button" variant="ghost" onClick={onBack}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button type="submit" disabled={loading || isUploadingLogo}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>

      {/* Logo Crop Dialog */}
      <Dialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) {
            setLogoImageSrc(null);
            setCropState({ x: 0, y: 0 });
            setZoomState(1);
            setRotationState(0);
            if (logoFileInputRef.current) {
              logoFileInputRef.current.value = "";
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[95vh] p-0 gap-0">
          {logoImageSrc && (
            <>
              <div className="p-6 w-full">
                <DialogHeader className="mb-4">
                  <DialogTitle>Crop Logo</DialogTitle>
                  <DialogDescription>
                    Adjust the crop area for your brand logo. Drag to move, scroll to zoom.
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full max-w-full max-h-[60vh] overflow-hidden flex items-center justify-center">
                  <div className="relative w-full max-w-md h-[400px] overflow-hidden rounded-lg border bg-muted">
                    <Cropper
                      aspectRatio={1}
                      zoom={zoomState}
                      rotation={rotationState}
                      crop={cropState}
                      onCropChange={setCropState}
                      onZoomChange={setZoomState}
                      onRotationChange={setRotationState}
                      onCropAreaChange={handleCropAreaChange}
                      minZoom={1}
                      maxZoom={3}
                      shape="rectangle"
                      withGrid
                    >
                      <CropperImage src={logoImageSrc} alt="Crop logo" />
                      <CropperArea />
                    </Cropper>
                  </div>
                </div>
              </div>
              <div className="p-6 pt-0 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCropState({ x: 0, y: 0 });
                    setZoomState(1);
                    setRotationState(0);
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (lastCropArea) {
                      processCrop(lastCropArea);
                    }
                  }}
                >
                  Apply crop
                </Button>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Step 3: Hashtags
// ============================================================================

interface HashtagStepProps {
  brandId: string;
  onBack: () => void;
  onFinish: () => void;
}

function HashtagStep({ brandId, onBack, onFinish }: HashtagStepProps) {
  return (
    <div className="space-y-6">
      <HashtagPresetsPanel brandId={brandId} />

      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onFinish}>
          <Check className="mr-2 h-4 w-4" />
          Finish
        </Button>
      </div>
    </div>
  );
}

