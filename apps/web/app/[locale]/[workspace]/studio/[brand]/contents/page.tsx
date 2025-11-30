"use client";

/**
 * Studio Brand Contents Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/contents
 * 
 * Content management page for the brand studio.
 */

import { useStudioBrand } from "@/features/studio/hooks";
import { StudioPageHeader } from "@/features/studio/components/studio-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

export default function StudioBrandContentsPage() {
  const { brand } = useStudioBrand();

  return (
    <div className="flex h-full flex-col">
      <StudioPageHeader brand={brand} pageTitle="Contents" />
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contents</h1>
            <p className="mt-1 text-muted-foreground">
              Create and manage your brand's content library
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </div>

        {/* Empty State */}
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardHeader className="text-center">
            <CardTitle>No content yet</CardTitle>
            <CardDescription className="max-w-sm">
              Start creating content for {brand.name}. You can create posts, 
              reels, stories, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create your first content
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

