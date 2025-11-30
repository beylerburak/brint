"use client";

/**
 * Studio Brand Calendar Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/calendar
 * 
 * Content calendar and scheduling page for the brand studio.
 */

import { useStudioBrand } from "@/features/studio/hooks";
import { StudioPageHeader } from "@/features/studio/components/studio-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function StudioBrandCalendarPage() {
  const { brand } = useStudioBrand();

  return (
    <div className="flex h-full flex-col">
      <StudioPageHeader brand={brand} pageTitle="Calendar" />
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-muted-foreground">
            Schedule and manage your content publishing calendar
          </p>
        </div>

        {/* Placeholder Calendar View */}
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardHeader className="text-center">
            <CardTitle>Content Calendar</CardTitle>
            <CardDescription className="max-w-sm">
              View and manage your scheduled posts for {brand.name}. 
              The calendar will show all scheduled, published, and draft content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Calendar view coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

