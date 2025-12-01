"use client";

import * as React from "react";
import { format, isToday, isSameDay, addHours, startOfDay, endOfDay, addDays, eachDayOfInterval } from "date-fns";
import { cn } from "@/shared/utils/index";
import { CalendarEvent } from "./index";
import { EventCard, MobileEventCard } from "./event-card";

interface Calendar3DayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  loading?: boolean;
  showAllEvents?: boolean;
}

const HOUR_HEIGHT = 60; // px per hour
const MAX_VISIBLE_EVENTS = 3;
const EVENT_SLOT_HEIGHT = 26; // Height per event slot

export function Calendar3DayView({
  date,
  events,
  onEventClick,
  onDayClick,
  loading = false,
  showAllEvents = false,
}: Calendar3DayViewProps) {
  // 3 günlük görünüm için: bugün, yarın, 2 gün sonrası
  const startDate = new Date(date);
  const endDate = addDays(startDate, 2);
  const threeDays = eachDayOfInterval({ start: startDate, end: endDate });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Track which cells are expanded locally
  const [expandedCells, setExpandedCells] = React.useState<Set<string>>(new Set());
  
  const toggleCellExpanded = (cellKey: string) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(cellKey)) {
        next.delete(cellKey);
      } else {
        next.add(cellKey);
      }
      return next;
    });
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return isSameDay(eventStart, day) || (
        eventStart <= endOfDay(day) && eventEnd >= startOfDay(day)
      );
    });
  };

  // Eventları saatlerine göre grupla ve sırala
  const getEventsGroupedByHour = (day: Date) => {
    const dayEvents = getEventsForDay(day);
    const grouped: Record<number, CalendarEvent[]> = {};
    
    // Önce saate göre grupla
    dayEvents.forEach(event => {
      const eventDate = new Date(event.start);
      const hour = eventDate.getHours();
      if (!grouped[hour]) {
        grouped[hour] = [];
      }
      grouped[hour].push(event);
    });
    
    // Her grup içinde saate göre sırala (en yeni en üstte)
    Object.keys(grouped).forEach(hour => {
      grouped[parseInt(hour)].sort((a, b) => 
        new Date(b.start).getTime() - new Date(a.start).getTime()
      );
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="bg-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[80px_repeat(3,1fr)] gap-px bg-border">
            <div className="bg-muted p-2"></div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted p-2 text-center">
                <div className="h-4 bg-muted-foreground/20 rounded animate-pulse mb-1" />
                <div className="h-6 bg-muted-foreground/20 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Body skeleton */}
          <div className="h-[600px] bg-muted-foreground/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="bg-border rounded-lg overflow-hidden">
        {/* Header row - sticky */}
        <div className="grid grid-cols-[80px_repeat(3,1fr)] gap-px bg-border sticky top-0 z-10">
          <div className="bg-muted p-2"></div>
          {threeDays.map((day) => (
            <div key={day.toISOString()} className="bg-muted p-2 text-center">
              <div className="text-sm font-medium mb-1">
                {format(day, "EEEE")}
              </div>
              <button
                type="button"
                onClick={() => onDayClick?.(day)}
                className={cn(
                  "text-lg font-bold rounded-full w-8 h-8 flex items-center justify-center mx-auto transition-colors",
                  isToday(day) && "bg-primary text-primary-foreground",
                  !isToday(day) && "hover:bg-muted-foreground/20 cursor-pointer"
                )}
                title={`${format(day, "d MMMM")} tarihinde içerik oluştur`}
              >
                {format(day, "d")}
              </button>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto max-h-[600px]">
          {/* Hour rows */}
          {hours.map((hour) => {
            return (
              <div key={hour} className="grid grid-cols-[80px_repeat(3,1fr)] gap-px bg-border">
                {/* Time label */}
                <div
                  className="bg-background text-right text-xs text-muted-foreground pr-2 border-b border-border/50 pt-1"
                  style={{ minHeight: HOUR_HEIGHT }}
                >
                  {format(addHours(startOfDay(new Date()), hour), "HH:mm")}
                </div>

                {/* Day cells for this hour */}
                {threeDays.map((day, dayIndex) => {
                  const groupedEvents = getEventsGroupedByHour(day);
                  const hourEvents = groupedEvents[hour] || [];
                  const cellKey = `${dayIndex}-${hour}`;
                  const isCellExpanded = expandedCells.has(cellKey);
                  const shouldShowAll = showAllEvents || isCellExpanded;
                  const visibleEvents = shouldShowAll ? hourEvents : hourEvents.slice(0, MAX_VISIBLE_EVENTS);
                  const hiddenCount = hourEvents.length - MAX_VISIBLE_EVENTS;

                  return (
                    <div
                      key={day.toISOString()}
                      className="bg-background border-b border-border/50 p-1 overflow-hidden"
                      style={{ minHeight: HOUR_HEIGHT }}
                    >
                      {visibleEvents.map((event) => (
                        <div key={event.id} className="mb-0.5 max-w-full overflow-hidden">
                          <EventCard
                            event={event}
                            onClick={() => onEventClick?.(event)}
                            compact
                          />
                          <MobileEventCard
                            event={event}
                            onClick={() => onEventClick?.(event)}
                          />
                        </div>
                      ))}
                      {!shouldShowAll && hiddenCount > 0 && (
                        <div
                          className="text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground px-2"
                          onClick={() => toggleCellExpanded(cellKey)}
                        >
                          +{hiddenCount} more
                        </div>
                      )}
                      {isCellExpanded && hourEvents.length > MAX_VISIBLE_EVENTS && (
                        <div
                          className="text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground px-2"
                          onClick={() => toggleCellExpanded(cellKey)}
                        >
                          Show less
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
