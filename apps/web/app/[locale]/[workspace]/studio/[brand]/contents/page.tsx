"use client";

/**
 * Studio Brand Contents Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/contents
 * 
 * Content management page for the brand studio.
 */

import { useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStudioBrand } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

export default function StudioBrandContentsPage() {
  const { brand } = useStudioBrand();
  const router = useRouter();
  const params = useParams();

  const handleNewContent = useCallback(() => {
    router.push(`/${params.locale}/${params.workspace}/studio/${params.brand}/contents/new`);
  }, [router, params.locale, params.workspace, params.brand]);

  // Set page header config
  const headerConfig = useMemo(() => ({
    title: "Contents",
    description: "Create and manage your brand's content library",
    actions: (
      <Button onClick={handleNewContent}>
        <Plus className="mr-2 h-4 w-4" />
        New Content
      </Button>
    ),
  }), [handleNewContent]);
  
  useStudioPageHeader(headerConfig);

  return (
    <div className="space-y-6 p-6">
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
          <Button onClick={handleNewContent}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first content
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
