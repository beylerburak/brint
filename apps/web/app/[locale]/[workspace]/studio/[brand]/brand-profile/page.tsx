"use client";

/**
 * Studio Brand Profile Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/brand-profile
 * 
 * Brand profile and settings page for the brand studio.
 */

import { useMemo } from "react";
import { useStudioBrand } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit, Globe, Palette, Building } from "lucide-react";

export default function StudioBrandProfilePage() {
  const { brand } = useStudioBrand();

  // Set page header config
  const headerConfig = useMemo(() => ({
    title: "Brand Profile",
    description: "Manage your brand's identity and settings",
    actions: (
      <Button variant="outline">
        <Edit className="mr-2 h-4 w-4" />
        Edit Profile
      </Button>
    ),
  }), []);
  
  useStudioPageHeader(headerConfig);

  return (
    <div className="space-y-6 p-6">
      {/* Brand Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-lg text-white text-xl font-bold"
              style={{ backgroundColor: brand.primaryColor || "hsl(var(--primary))" }}
            >
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-12 w-12 object-contain"
                />
              ) : (
                brand.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {brand.name}
                <Badge variant={brand.status === "ACTIVE" ? "default" : "secondary"}>
                  {brand.status}
                </Badge>
              </CardTitle>
              <CardDescription>@{brand.slug}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {brand.description || "No description provided"}
          </p>
        </CardContent>
      </Card>

      {/* Brand Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* General Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="h-4 w-4" />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Industry</span>
              <span className="text-sm font-medium">
                {brand.industry || "Not specified"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Language</span>
              <span className="text-sm font-medium">
                {brand.language?.toUpperCase() || "Not specified"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Timezone</span>
              <span className="text-sm font-medium">
                {brand.timezone || "Not specified"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tone of Voice</span>
              <span className="text-sm font-medium">
                {brand.toneOfVoice || "Not specified"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Brand Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              Brand Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Primary Color</span>
              <div className="flex items-center gap-2">
                {brand.primaryColor && (
                  <div
                    className="h-5 w-5 rounded border"
                    style={{ backgroundColor: brand.primaryColor }}
                  />
                )}
                <span className="text-sm font-medium">
                  {brand.primaryColor || "Not set"}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Secondary Color</span>
              <div className="flex items-center gap-2">
                {brand.secondaryColor && (
                  <div
                    className="h-5 w-5 rounded border"
                    style={{ backgroundColor: brand.secondaryColor }}
                  />
                )}
                <span className="text-sm font-medium">
                  {brand.secondaryColor || "Not set"}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Logo</span>
              <span className="text-sm font-medium">
                {brand.logoUrl ? "Uploaded" : "Not uploaded"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Website & Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Website & Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Website</span>
              {brand.websiteUrl ? (
                <a
                  href={brand.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {brand.websiteUrl}
                </a>
              ) : (
                <span className="text-sm font-medium">Not specified</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Readiness Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setup Progress</CardTitle>
            <CardDescription>
              Complete your brand setup to unlock all features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Profile Completed</span>
              <Badge variant={brand.profileCompleted ? "default" : "outline"}>
                {brand.profileCompleted ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Social Account Connected</span>
              <Badge variant={brand.hasAtLeastOneSocialAccount ? "default" : "outline"}>
                {brand.hasAtLeastOneSocialAccount ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Publishing Defaults</span>
              <Badge variant={brand.publishingDefaultsConfigured ? "default" : "outline"}>
                {brand.publishingDefaultsConfigured ? "Configured" : "Not configured"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Readiness Score</span>
              <span className="text-lg font-bold">{brand.readinessScore}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
