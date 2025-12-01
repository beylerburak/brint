"use client";

import * as React from "react";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarWeekView } from "./calendar-week-view";
import { Calendar3DayView } from "./calendar-3day-view";
import { CalendarDayView } from "./calendar-day-view";
import { CalendarAgendaView } from "./calendar-agenda-view";
import { EventModal } from "./event-modal";

export type CalendarView = "month" | "week" | "3day" | "day" | "agenda";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  color?: string;
  socialAccountId?: string | null;
  platform?: string;
  status?: string;
}

export interface CalendarProps {
  /** Current date to display */
  currentDate?: Date;
  /** Events to display on calendar */
  events?: CalendarEvent[];
  /** Current view */
  view?: CalendarView;
  /** Available views */
  availableViews?: CalendarView[];
  /** Callback when view changes */
  onViewChange?: (view: CalendarView) => void;
  /** Callback when date changes */
  onDateChange?: (date: Date) => void;
  /** Callback when event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Callback for toolbar action button */
  onActionClick?: () => void;
  /** Custom action button label */
  actionButtonLabel?: string;
  /** Additional toolbar actions */
  toolbarActions?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Custom className */
  className?: string;
  /** Compact view - limits events shown per slot */
  compactView?: boolean;
  /** Callback when compact view changes */
  onCompactViewChange?: (compact: boolean) => void;
  /** Search input placeholder text */
  searchPlaceholder?: string;
  /** Social accounts for platform avatars */
  socialAccounts?: Array<{
    id: string;
    platform: string;
    avatarUrl?: string | null;
    displayName?: string | null;
    username?: string | null;
    profileUrl?: string | null;
  }>;
  /** Brand logo URL as fallback for avatars */
  brandLogoUrl?: string | null;
}

export function Calendar({
  currentDate = new Date(),
  events = [],
  view = "month",
  availableViews = ["month", "week", "3day", "day", "agenda"],
  onViewChange,
  onDateChange,
  onEventClick,
  onActionClick,
  actionButtonLabel = "New Event",
  toolbarActions,
  loading = false,
  className,
  compactView,
  onCompactViewChange,
  searchPlaceholder,
  socialAccounts = [],
  brandLogoUrl,
}: CalendarProps) {
  // Debug: Log social accounts to verify they're being passed
  React.useEffect(() => {
    if (socialAccounts && socialAccounts.length > 0) {
      console.log('Calendar: Social accounts received:', socialAccounts);
    }
  }, [socialAccounts]);
  const [internalDate, setInternalDate] = React.useState(currentDate);
  const [internalView, setInternalView] = React.useState(view);
  const [internalCompactView, setInternalCompactView] = React.useState(compactView ?? true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<Set<string>>(new Set());

  // Get all platforms from social accounts (all accounts, not just those with events)
  // Normalize platform names to match event platform format
  const normalizePlatform = (platform: string): string => {
    const platformKey = platform.toLowerCase();
    if (platformKey.includes('instagram')) {
      return 'instagram';
    } else if (platformKey.includes('facebook')) {
      return 'facebook';
    } else if (platformKey.includes('x') || platformKey.includes('twitter')) {
      return 'x';
    } else if (platformKey.includes('youtube')) {
      return 'youtube';
    } else if (platformKey.includes('tiktok')) {
      return 'tiktok';
    } else if (platformKey.includes('pinterest')) {
      return 'pinterest';
    } else if (platformKey.includes('linkedin')) {
      return 'linkedin';
    } else {
      // For unknown platforms, try to extract a simple name
      return platformKey.split('_')[0];
    }
  };

  const availablePlatforms = React.useMemo(() => {
    const platformSet = new Set<string>();
    
    // Add all platforms from social accounts (all accounts, not just those with events)
    if (socialAccounts && socialAccounts.length > 0) {
      socialAccounts.forEach(account => {
        if (account.platform) {
          const normalized = normalizePlatform(account.platform);
          platformSet.add(normalized);
        }
      });
    }
    
    // Also add platforms from events (in case there are events without accounts)
    if (events && events.length > 0) {
      events.forEach(event => {
        if (event.platform) {
          platformSet.add(normalizePlatform(event.platform));
        }
      });
    }
    
    const platforms = Array.from(platformSet).sort();
    // Debug: Log available platforms
    if (platforms.length > 0) {
      console.log('Calendar: Available platforms:', platforms, 'from', socialAccounts?.length || 0, 'social accounts');
    }
    return platforms;
  }, [socialAccounts, events]);

  // Filter events based on search query and platform filter
  const filteredEvents = React.useMemo(() => {
    let filtered = events;

    // Platform filter
    if (selectedPlatforms.size > 0) {
      filtered = filtered.filter((event) => 
        event.platform && selectedPlatforms.has(event.platform)
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((event) => {
        const titleMatch = event.title?.toLowerCase().includes(query);
        const descriptionMatch = event.description?.toLowerCase().includes(query);
        const platformMatch = event.platform?.toLowerCase().includes(query);
        const statusMatch = event.status?.toLowerCase().includes(query);
        
        return titleMatch || descriptionMatch || platformMatch || statusMatch;
      });
    }

    return filtered;
  }, [events, searchQuery, selectedPlatforms]);

  const date = onDateChange ? currentDate : internalDate;
  const currentView = onViewChange ? view : internalView;
  const isCompactView = onCompactViewChange ? (compactView ?? true) : internalCompactView;

  const handleCompactViewChange = React.useCallback((compact: boolean) => {
    if (onCompactViewChange) {
      onCompactViewChange(compact);
    } else {
      setInternalCompactView(compact);
    }
  }, [onCompactViewChange]);

  const handleDateChange = React.useCallback((newDate: Date) => {
    if (onDateChange) {
      onDateChange(newDate);
    } else {
      setInternalDate(newDate);
    }
  }, [onDateChange]);

  const handleViewChange = React.useCallback((newView: CalendarView) => {
    if (onViewChange) {
      onViewChange(newView);
    } else {
      setInternalView(newView);
    }
  }, [onViewChange]);

  const handleTodayClick = React.useCallback(() => {
    handleDateChange(new Date());
  }, [handleDateChange]);

  const handlePrevPeriod = React.useCallback(() => {
    const newDate = new Date(date);
    switch (currentView) {
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() - 7);
        break;
      case "3day":
        newDate.setDate(newDate.getDate() - 3);
        break;
      case "day":
        newDate.setDate(newDate.getDate() - 1);
        break;
      case "agenda":
        newDate.setDate(newDate.getDate() - 30);
        break;
    }
    handleDateChange(newDate);
  }, [date, currentView, handleDateChange]);

  const handleNextPeriod = React.useCallback(() => {
    const newDate = new Date(date);
    switch (currentView) {
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "3day":
        newDate.setDate(newDate.getDate() + 3);
        break;
      case "day":
        newDate.setDate(newDate.getDate() + 1);
        break;
      case "agenda":
        newDate.setDate(newDate.getDate() + 30);
        break;
    }
    handleDateChange(newDate);
  }, [date, currentView, handleDateChange]);

  const renderView = () => {
    const viewProps = {
      date,
      events: filteredEvents,
      onEventClick,
      loading,
      showAllEvents: !isCompactView,
    };

    switch (currentView) {
      case "month":
        return <CalendarMonthView {...viewProps} />;
      case "week":
        return <CalendarWeekView {...viewProps} />;
      case "3day":
        return <Calendar3DayView {...viewProps} />;
      case "day":
        return <CalendarDayView {...viewProps} />;
      case "agenda":
        return <CalendarAgendaView {...viewProps} />;
      default:
        return <CalendarMonthView {...viewProps} />;
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <CalendarToolbar
        date={date}
        view={currentView}
        availableViews={availableViews}
        onViewChange={handleViewChange}
        onTodayClick={handleTodayClick}
        onPrevClick={handlePrevPeriod}
        onNextClick={handleNextPeriod}
        onActionClick={onActionClick}
        actionButtonLabel={actionButtonLabel}
        additionalActions={toolbarActions}
        compactView={isCompactView}
        onCompactViewChange={handleCompactViewChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={searchPlaceholder}
        availablePlatforms={availablePlatforms}
        selectedPlatforms={selectedPlatforms}
        onPlatformsChange={setSelectedPlatforms}
        socialAccounts={socialAccounts}
        brandLogoUrl={brandLogoUrl}
      />
      <div className="flex-1 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
}

export { EventModal };
