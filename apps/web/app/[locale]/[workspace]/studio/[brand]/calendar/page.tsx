"use client";

/**
 * Studio Brand Calendar Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/calendar
 * 
 * Content calendar and scheduling page for the brand studio.
 */

import { useMemo } from "react";
import { useStudioBrand } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function StudioBrandCalendarPage() {
  const { brand } = useStudioBrand();

  // Set page header config
  const headerConfig = useMemo(() => ({
    title: "Calendar",
    description: "Schedule and manage your content publishing calendar",
  }), []);
  
  useStudioPageHeader(headerConfig);

  return (
    <div className="space-y-6 p-6">
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
  );
}
