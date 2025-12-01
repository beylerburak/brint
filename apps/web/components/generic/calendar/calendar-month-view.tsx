"use client";

import * as React from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { cn } from "@/shared/utils/index";
import { CalendarEvent } from "./index";
import { EventCard, MobileEventCard } from "./event-card";

interface CalendarMonthViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  loading?: boolean;
  showAllEvents?: boolean;
}

const MAX_VISIBLE_EVENTS = 3;

export function CalendarMonthView({
  date,
  events,
  onEventClick,
  onDayClick,
  loading = false,
  showAllEvents = false,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  // Track which days are expanded locally
  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(new Set());
  
  const toggleDayExpanded = (dayKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  const getEventsForDay = (day: Date) => {
    return events
      .filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return isSameDay(eventStart, day) || (
          eventStart <= day && eventEnd >= day
        );
      })
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {/* Header skeleton */}
          {weekDays.map((_, i) => (
            <div key={i} className="bg-muted p-2 text-center text-sm font-medium border-b">
              <div className="h-4 bg-muted-foreground/20 rounded animate-pulse" />
            </div>
          ))}
          {/* Days skeleton */}
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="bg-background p-2 min-h-[120px]">
              <div className="h-4 bg-muted-foreground/20 rounded animate-pulse mb-2" />
              <div className="space-y-1">
                <div className="h-3 bg-muted-foreground/10 rounded animate-pulse" />
                <div className="h-3 bg-muted-foreground/10 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Week day headers */}
        {weekDays.map((day) => (
          <div
            key={day}
            className="bg-muted p-2 text-center text-sm font-medium border-b"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isDayToday = isToday(day);
          const dayKey = day.toISOString();
          const isDayExpanded = expandedDays.has(dayKey);
          const shouldShowAll = showAllEvents || isDayExpanded;
          const visibleEvents = shouldShowAll ? dayEvents : dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={index}
              className={cn(
                "bg-background p-2 min-h-[120px] relative",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground"
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick?.(day)}
                className={cn(
                  "text-sm font-medium mb-2 w-6 h-6 flex items-center justify-center rounded-full mx-auto transition-colors",
                  isDayToday && "bg-primary text-primary-foreground font-bold",
                  !isDayToday && "hover:bg-muted cursor-pointer"
                )}
                title={`${format(day, "d MMMM")} tarihinde içerik oluştur`}
              >
                {format(day, "d")}
              </button>

              {/* Events */}
              <div className="space-y-1">
                {visibleEvents.map((event) => (
                  <React.Fragment key={event.id}>
                    <EventCard
                      event={event}
                      onClick={() => onEventClick?.(event)}
                    />
                    <MobileEventCard
                      event={event}
                      onClick={() => onEventClick?.(event)}
                    />
                  </React.Fragment>
                ))}
                {!shouldShowAll && hiddenCount > 0 && (
                  <div
                    className="text-sm text-muted-foreground font-medium cursor-pointer hover:text-foreground px-1"
                    onClick={() => toggleDayExpanded(dayKey)}
                  >
                    +{hiddenCount} more
                  </div>
                )}
                {isDayExpanded && dayEvents.length > MAX_VISIBLE_EVENTS && (
                  <div
                    className="text-sm text-muted-foreground font-medium cursor-pointer hover:text-foreground px-1"
                    onClick={() => toggleDayExpanded(dayKey)}
                  >
                    Show less
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
