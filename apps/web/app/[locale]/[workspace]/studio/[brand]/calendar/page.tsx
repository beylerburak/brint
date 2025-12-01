"use client";

/**
 * Studio Brand Calendar Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/calendar
 * 
 * Content calendar and scheduling page for the brand studio.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useStudioBrand, useCalendarPublications } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { useSocialAccounts } from "@/features/social-account/hooks";
import { Calendar, CalendarEvent, CalendarView, EventModal } from "@/components/generic/calendar/index";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudioBrandCalendarPage() {
  const router = useRouter();
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { brand } = useStudioBrand();
  const [currentDate, setCurrentDate] = useState(new Date(2025, 11, 1)); // Start with December 1st, 2025
  const [currentView, setCurrentView] = useState<CalendarView>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Fetch real publication data
  const { events: publicationEvents, isLoading: publicationsLoading } = useCalendarPublications(brand.id);
  
  // Fetch social accounts for platform avatars
  const { accounts: socialAccounts } = useSocialAccounts({ 
    brandId: brand.id,
    status: "ACTIVE",
  });

  // Set page header config
  const headerConfig = useMemo(() => ({
    title: "Calendar",
    description: `Schedule and manage your content publishing calendar for ${brand.name}`,
  }), [brand.name]);

  useStudioPageHeader(headerConfig);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleActionClick = () => {
    if (!workspace?.slug) return;
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    router.push(`${localePrefix}/${workspace.slug}/studio/${brand.slug}/contents/new`);
  };

  const handleDayClick = (date: Date) => {
    if (!workspace?.slug) return;
    const localePrefix = locale === "en" ? "" : `/${locale}`;
    // Navigate to new content page with date as query param
    const dateStr = date.toISOString().split('T')[0];
    router.push(`${localePrefix}/${workspace.slug}/studio/${brand.slug}/contents/new?date=${dateStr}`);
  };

  return (
    <div className="h-full flex flex-col">
      <Calendar
        currentDate={currentDate}
        events={publicationEvents}
        view={currentView}
        onDateChange={setCurrentDate}
        onViewChange={setCurrentView}
        onEventClick={handleEventClick}
        onDayClick={handleDayClick}
        onActionClick={handleActionClick}
        actionButtonLabel="New Content"
        loading={publicationsLoading}
        className="flex-1"
        searchPlaceholder="Search contents..."
        socialAccounts={socialAccounts}
        brandLogoUrl={brand.logoUrl}
      />

      <EventModal
        event={selectedEvent}
        open={isEventModalOpen}
        onOpenChange={setIsEventModalOpen}
        onEdit={(event) => {
          console.log("Edit event:", event);
          // TODO: Navigate to edit page or open edit modal
        }}
        onDelete={(event) => {
          console.log("Delete event:", event);
          // TODO: Show confirmation dialog and delete
        }}
      />
    </div>
  );
}
