"use client";

/**
 * Brand Onboarding Wizard Page
 * 
 * Multi-step wizard for setting up a new brand.
 * Handles:
 * - Step 1: Brand Profile (name, description, industry, language, timezone)
 * - Step 2: Brand Identity (logo, colors, website, tone of voice)
 * - Step 3: Social Accounts (connect social media accounts)
 * 
 * On completion, brand status changes from DRAFT to ACTIVE.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Upload,
  Briefcase,
  X,
  User,
  Palette,
  Share2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { buildWorkspaceRoute } from "@/features/space/constants";
import { useBrand } from "../hooks/use-brand";
import { useUpdateBrand } from "../hooks/use-brand-mutations";
import { updateBrandOnboarding, completeBrandOnboarding } from "../api/brand-api";
import { BrandSocialAccountsPanel } from "./brand-social-accounts-panel";
import { getMediaConfig, presignUpload, finalizeUpload, type MediaConfig } from "@/shared/api/media";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";
import type { BrandDetail, UpdateBrandRequest } from "../types";

// ============================================================================
// Form Schemas
// ============================================================================

const profileSchema = z.object({
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

type ProfileFormData = z.infer<typeof profileSchema>;
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

const STEPS = [
  { id: 1, title: "Profile", description: "Basic brand information", icon: User },
  { id: 2, title: "Identity", description: "Branding & appearance", icon: Palette },
  { id: 3, title: "Social", description: "Connect accounts", icon: Share2 },
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

function slugify(text: string): string {
  let slug = text.toLowerCase();
  for (const [turkishChar, asciiChar] of Object.entries(TR_CHAR_MAP)) {
    slug = slug.replace(new RegExp(turkishChar, 'g'), asciiChar);
  }
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');
  return slug;
}

// ============================================================================
// Main Component
// ============================================================================

interface BrandOnboardingWizardPageProps {
  brandId: string;
}

export function BrandOnboardingWizardPage({ brandId }: BrandOnboardingWizardPageProps) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  
  const { brand, loading, error, refresh } = useBrand(brandId);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Redirect if brand is not in DRAFT or already completed
  useEffect(() => {
    if (!loading && brand) {
      if (brand.status !== "DRAFT" || brand.onboardingCompleted) {
        const studioPath = buildWorkspaceRoute(
          locale,
          workspace?.slug || "",
          `studio/${brand.slug}`
        );
        router.replace(studioPath);
      } else {
        // Resume from saved step
        setCurrentStep(Math.max(1, brand.onboardingStep + 1));
      }
    }
  }, [brand, loading, locale, workspace?.slug, router]);

  const totalSteps = STEPS.length;
  const progress = (currentStep / totalSteps) * 100;

  // Handle step save
  const handleSaveStep = useCallback(async (stepData: UpdateBrandRequest, stepNumber: number) => {
    setIsSaving(true);
    try {
      await updateBrandOnboarding(brandId, {
        step: stepNumber,
        data: stepData,
      });
      refresh();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [brandId, refresh, toast]);

  // Handle complete onboarding
  const handleComplete = useCallback(async () => {
    if (!workspace?.slug || !brand?.slug) return;
    
    setIsCompleting(true);
    try {
      await completeBrandOnboarding(brandId);
      
      toast({
        title: "Brand setup complete! 🎉",
        description: "Your brand is now active and ready to use.",
      });

      // Redirect to studio
      const studioPath = buildWorkspaceRoute(
        locale,
        workspace.slug,
        `studio/${brand.slug}`
      );
      router.push(studioPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete setup";
      toast({
        title: "Setup failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  }, [brandId, brand?.slug, workspace?.slug, locale, router, toast]);

  // Loading state
  if (loading) {
    return <WizardSkeleton />;
  }

  // Error or not found state
  if (error || !brand) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Brand not found</h2>
          <p className="text-muted-foreground">
            {error?.message || "The brand you're looking for doesn't exist."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(buildWorkspaceRoute(locale, workspace?.slug || "", "brands"))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to brands
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(buildWorkspaceRoute(locale, workspace?.slug || "", "brands"))}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Set up {brand.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Complete the steps below to activate your brand
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm font-medium">
              {STEPS[currentStep - 1].title}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2",
                    isActive ? "text-primary" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && "border-primary bg-primary/10 text-primary",
                      !isActive && !isCompleted && "border-muted-foreground/25"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        {currentStep === 1 && (
          <ProfileStep
            brand={brand}
            isSaving={isSaving}
            onNext={async (data) => {
              const success = await handleSaveStep(data, 1);
              if (success) setCurrentStep(2);
            }}
            onBack={() => router.push(buildWorkspaceRoute(locale, workspace?.slug || "", "brands"))}
          />
        )}

        {currentStep === 2 && (
          <IdentityStep
            brand={brand}
            brandId={brandId}
            isSaving={isSaving}
            onNext={async (data) => {
              const success = await handleSaveStep(data, 2);
              if (success) setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <SocialStep
            brand={brand}
            brandId={brandId}
            isCompleting={isCompleting}
            onComplete={handleComplete}
            onBack={() => setCurrentStep(2)}
            onBrandRefresh={refresh}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step 1: Profile
// ============================================================================

interface ProfileStepProps {
  brand: BrandDetail;
  isSaving: boolean;
  onNext: (data: ProfileFormData) => Promise<void>;
  onBack: () => void;
}

function ProfileStep({ brand, isSaving, onNext, onBack }: ProfileStepProps) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!brand.slug);
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: brand.name || "",
      slug: brand.slug || "",
      description: brand.description || "",
      industry: brand.industry || "",
      language: brand.language || "",
      timezone: brand.timezone || "",
    },
  });

  const nameValue = useWatch({ control: form.control, name: "name" });

  useEffect(() => {
    if (!slugManuallyEdited && nameValue) {
      const generatedSlug = slugify(nameValue);
      form.setValue("slug", generatedSlug, { shouldValidate: false });
    }
  }, [nameValue, slugManuallyEdited, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Profile</CardTitle>
        <CardDescription>
          Tell us about your brand. This information helps personalize your experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onNext)} className="space-y-6">
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
                        setSlugManuallyEdited(true);
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
              <Button type="button" variant="ghost" onClick={onBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step 2: Identity
// ============================================================================

interface IdentityStepProps {
  brand: BrandDetail;
  brandId: string;
  isSaving: boolean;
  onNext: (data: IdentityFormData & { logoMediaId?: string | null }) => Promise<void>;
  onBack: () => void;
}

function IdentityStep({ brand, brandId, isSaving, onNext, onBack }: IdentityStepProps) {
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logoUrl || null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoMediaId, setLogoMediaId] = useState<string | null>(brand.logoMediaId || null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
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
      websiteUrl: brand.websiteUrl || "",
      toneOfVoice: brand.toneOfVoice || "",
      primaryColor: brand.primaryColor || "",
      secondaryColor: brand.secondaryColor || "",
    },
  });

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

  const handleCropAreaChange = useCallback((_: unknown, croppedAreaPixels: CropperAreaData) => {
    setLastCropArea(croppedAreaPixels);
  }, []);

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

    const outputSize = Math.min(cropArea.width, 512);
    canvas.width = outputSize;
    canvas.height = outputSize;

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

    canvas.toBlob((blob) => {
      if (!blob) return;

      const croppedFile = new File([blob], "brand-logo.png", { type: "image/png" });
      const previewUrl = URL.createObjectURL(croppedFile);
      setLogoPreview(previewUrl);
      setPendingLogoFile(croppedFile);
      setLogoMediaId(null);
      setCropDialogOpen(false);
      
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
    }, "image/png", 0.9);
  }, [logoImageSrc]);

  const handleRemoveLogo = useCallback(() => {
    setLogoPreview(null);
    setLogoMediaId(null);
    setPendingLogoFile(null);
  }, []);

  const uploadPendingLogo = useCallback(async (): Promise<string | null> => {
    if (!pendingLogoFile || !workspace?.id) return null;

    const presign = await presignUpload({
      workspaceId: workspace.id,
      brandId: brandId,
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
      brandId: brandId,
      originalName: pendingLogoFile.name,
      contentType: pendingLogoFile.type,
      assetType: "avatar",
    });

    return finalizeResponse.media.id;
  }, [pendingLogoFile, workspace?.id, brandId]);

  const handleSubmit = useCallback(async (data: IdentityFormData) => {
    setIsUploadingLogo(true);
    
    try {
      let finalLogoMediaId = logoMediaId;
      
      if (pendingLogoFile) {
        finalLogoMediaId = await uploadPendingLogo();
        setPendingLogoFile(null);
        setLogoMediaId(finalLogoMediaId);
      }
      
      await onNext({
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
  }, [onNext, logoMediaId, pendingLogoFile, uploadPendingLogo, toast]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Brand Identity</CardTitle>
          <CardDescription>
            Define your brand's visual identity and voice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                    {(isSaving || isUploadingLogo) && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={isSaving || isUploadingLogo}
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
                          disabled={isSaving || isUploadingLogo}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or GIF. Max 5MB.
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
                          <ColorPickerTrigger className="h-9 w-full justify-start rounded-md border border-input bg-transparent px-3 py-1 shadow-xs hover:bg-transparent">
                            <ColorPickerSwatch className="h-5 w-5 rounded" />
                            <span className="ml-2 font-mono text-sm">
                              {field.value || "Select"}
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
                          <ColorPickerTrigger className="h-9 w-full justify-start rounded-md border border-input bg-transparent px-3 py-1 shadow-xs hover:bg-transparent">
                            <ColorPickerSwatch className="h-5 w-5 rounded" />
                            <span className="ml-2 font-mono text-sm">
                              {field.value || "Select"}
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
                <Button type="submit" disabled={isSaving || isUploadingLogo}>
                  {(isSaving || isUploadingLogo) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Logo Crop Dialog */}
      <Dialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) {
            setLogoImageSrc(null);
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
                    Adjust the crop area for your brand logo.
                  </DialogDescription>
                </DialogHeader>
                <div className="relative w-full max-w-md h-[400px] mx-auto overflow-hidden rounded-lg border bg-muted">
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
// Step 3: Social Accounts
// ============================================================================

interface SocialStepProps {
  brand: BrandDetail;
  brandId: string;
  isCompleting: boolean;
  onComplete: () => Promise<void>;
  onBack: () => void;
  onBrandRefresh: () => void;
}

function SocialStep({ brand, brandId, isCompleting, onComplete, onBack, onBrandRefresh }: SocialStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect Social Accounts</CardTitle>
          <CardDescription>
            Connect your social media accounts to start publishing content.
            You can skip this step and add accounts later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandSocialAccountsPanel brandId={brandId} onBrandRefresh={onBrandRefresh} />
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Almost there!</AlertTitle>
        <AlertDescription>
          Click "Finish Setup" to activate your brand. You can always add more social accounts
          and customize settings later from the Brand Studio.
        </AlertDescription>
      </Alert>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onComplete} disabled={isCompleting}>
          {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Check className="mr-2 h-4 w-4" />
          Finish Setup
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function WizardSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-20" />
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

