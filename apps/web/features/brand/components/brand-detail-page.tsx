"use client";

/**
 * Brand Detail Page
 * 
 * Displays detailed information about a brand with tabs for:
 * - Overview (profile info)
 * - Hashtag Presets
 * - Activity (read-only)
 */

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  Pencil,
  Globe,
  Palette,
  Clock,
  Building,
  Languages,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useHasPermission, usePagePermissions } from "@/features/permissions/hooks/hooks";
import { buildWorkspaceRoute } from "@/features/space/constants";
import { useBrandBySlug, useArchiveBrand } from "../hooks";
import { BrandReadinessPanel } from "./brand-readiness-panel";
import { BrandWizard } from "./brand-wizard";
import { HashtagPresetsPanel } from "./hashtag-presets-panel";
import { BrandActivityPanel } from "./brand-activity-panel";
import { BrandSocialAccountsPanel } from "./brand-social-accounts-panel";

interface BrandDetailPageProps {
  brandSlug: string;
}

export function BrandDetailPage({ brandSlug }: BrandDetailPageProps) {
  const locale = useLocale();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const { permissions, loading: permissionsLoading } = usePagePermissions();
  const canView = useHasPermission("studio:brand.view");
  const canUpdate = useHasPermission("studio:brand.update");
  const canDelete = useHasPermission("studio:brand.delete");
  const canViewSocialAccounts = useHasPermission("studio:social_account.view");

  const { brand, loading, error, refresh } = useBrandBySlug(brandSlug);
  const { archiveBrand, loading: archiveLoading } = useArchiveBrand(brand?.id ?? null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Permission check
  if (!permissionsLoading && !canView) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Palette className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You don&apos;t have permission to view this brand.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return <BrandDetailSkeleton />;
  }

  // Error state
  if (error || !brand) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Palette className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Brand not found</h2>
          <p className="text-muted-foreground">
            {error?.message || "The brand you're looking for doesn't exist."}
          </p>
        </div>
        <Link href={buildWorkspaceRoute(locale, workspace?.slug || "", "studio/brands")}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to brands
          </Button>
        </Link>
      </div>
    );
  }

  const handleArchive = async () => {
    const success = await archiveBrand();
    if (success) {
      router.push(buildWorkspaceRoute(locale, workspace?.slug || "", "studio/brands"));
    }
  };

  const handleWizardSuccess = () => {
    setWizardOpen(false);
    refresh();
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Back link */}
      <Link
        href={buildWorkspaceRoute(locale, workspace?.slug || "", "studio/brands")}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to brands
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{brand.name}</h1>
            {brand.isArchived && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </div>
          <p className="text-muted-foreground">/{brand.slug}</p>
        </div>

        <div className="flex gap-2">
          {canUpdate && (
            <Button variant="outline" onClick={() => setWizardOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canDelete && !brand.isArchived && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setArchiveDialogOpen(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Readiness Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Brand Readiness</CardTitle>
          <CardDescription>
            Complete all steps to maximize your brand&apos;s potential
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandReadinessPanel
            data={{
              readinessScore: brand.readinessScore,
              profileCompleted: brand.profileCompleted,
              hasAtLeastOneSocialAccount: brand.hasAtLeastOneSocialAccount,
              publishingDefaultsConfigured: brand.publishingDefaultsConfigured,
            }}
            variant="full"
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canViewSocialAccounts && (
            <TabsTrigger value="social-accounts">Social Accounts</TabsTrigger>
          )}
          <TabsTrigger value="hashtags">Hashtag Presets</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab brand={brand} />
        </TabsContent>

        {canViewSocialAccounts && (
          <TabsContent value="social-accounts" className="mt-4">
            <BrandSocialAccountsPanel brandId={brand.id} onBrandRefresh={refresh} />
          </TabsContent>
        )}

        <TabsContent value="hashtags" className="mt-4">
          <HashtagPresetsPanel brandId={brand.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <BrandActivityPanel brandId={brand.id} />
        </TabsContent>
      </Tabs>

      {/* Edit Wizard */}
      <BrandWizard
        open={wizardOpen}
        brand={brand}
        onClose={() => setWizardOpen(false)}
        onSuccess={handleWizardSuccess}
      />

      {/* Archive Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{brand.name}&quot;? This will hide the brand
              from the active list, but you can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiveLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveLoading ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

interface OverviewTabProps {
  brand: NonNullable<ReturnType<typeof useBrandBySlug>["brand"]>;
}

function OverviewTab({ brand }: OverviewTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {brand.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm mt-1">{brand.description}</p>
            </div>
          )}

          <InfoItem
            icon={<Building className="h-4 w-4" />}
            label="Industry"
            value={brand.industry}
          />

          <InfoItem
            icon={<Languages className="h-4 w-4" />}
            label="Language"
            value={brand.language}
          />

          <InfoItem
            icon={<Clock className="h-4 w-4" />}
            label="Timezone"
            value={brand.timezone}
          />
        </CardContent>
      </Card>

      {/* Identity Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoItem
            icon={<Globe className="h-4 w-4" />}
            label="Website"
            value={brand.websiteUrl}
            isLink
          />

          <InfoItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Tone of Voice"
            value={brand.toneOfVoice}
          />

          <div className="flex gap-4">
            <ColorSwatch label="Primary" color={brand.primaryColor} />
            <ColorSwatch label="Secondary" color={brand.secondaryColor} />
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{new Date(brand.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p>{new Date(brand.updatedAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ID</p>
              <p className="font-mono text-xs">{brand.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  isLink?: boolean;
}

function InfoItem({ icon, label, value, isLink }: InfoItemProps) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-muted-foreground">{label}:</span>
        <span className="text-muted-foreground italic">Not set</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

interface ColorSwatchProps {
  label: string;
  color: string | null | undefined;
}

function ColorSwatch({ label, color }: ColorSwatchProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-6 w-6 rounded border"
        style={{ backgroundColor: color || "#e5e7eb" }}
      />
      <div className="text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-mono text-xs">{color || "Not set"}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function BrandDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <Skeleton className="h-4 w-24" />

      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <Skeleton className="h-10 w-72" />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

