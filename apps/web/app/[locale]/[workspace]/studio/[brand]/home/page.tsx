"use client";

/**
 * Studio Brand Home Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/home
 * 
 * Main dashboard/overview page for the brand studio.
 */

import { useStudioBrand } from "@/features/studio/hooks";
import { StudioPageHeader } from "@/features/studio/components/studio-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, Users, FileText } from "lucide-react";

export default function StudioBrandHomePage() {
  const { brand } = useStudioBrand();

  return (
    <div className="flex h-full flex-col">
      <StudioPageHeader brand={brand} pageTitle="Home" />
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {brand.name} Studio
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your brand's content, social accounts, and publishing from one place.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Readiness Score
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{brand.readinessScore}%</div>
              <p className="text-xs text-muted-foreground">
                Brand setup completion
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Social Accounts
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {brand.hasAtLeastOneSocialAccount ? "Connected" : "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {brand.hasAtLeastOneSocialAccount 
                  ? "Ready to publish" 
                  : "Connect to start publishing"
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Profile Status
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {brand.profileCompleted ? "Complete" : "Incomplete"}
              </div>
              <p className="text-xs text-muted-foreground">
                Brand profile setup
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Content Status
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Ready</div>
              <p className="text-xs text-muted-foreground">
                Create your first post
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Section */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Complete these steps to get the most out of your Brand Studio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${brand.profileCompleted ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  {brand.profileCompleted ? "✓" : "1"}
                </div>
                <div>
                  <p className="font-medium">Complete your brand profile</p>
                  <p className="text-sm text-muted-foreground">
                    Add logo, description, and brand colors
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${brand.hasAtLeastOneSocialAccount ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  {brand.hasAtLeastOneSocialAccount ? "✓" : "2"}
                </div>
                <div>
                  <p className="font-medium">Connect social accounts</p>
                  <p className="text-sm text-muted-foreground">
                    Link your Instagram, Facebook, or other platforms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  3
                </div>
                <div>
                  <p className="font-medium">Create your first content</p>
                  <p className="text-sm text-muted-foreground">
                    Start creating and scheduling posts
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

