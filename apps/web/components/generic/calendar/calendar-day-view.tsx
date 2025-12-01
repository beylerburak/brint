"use client";

import * as React from "react";
import { format, addHours, startOfDay, endOfDay, isToday, isSameDay } from "date-fns";
import { cn } from "@/shared/utils/index";
import { CalendarEvent } from "./index";
import { EventCard, MobileEventCard } from "./event-card";

interface CalendarDayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  loading?: boolean;
  showAllEvents?: boolean;
}

const HOUR_HEIGHT = 60; // px per hour
const MAX_VISIBLE_EVENTS = 3;
const EVENT_SLOT_HEIGHT = 28; // Height per event slot

export function CalendarDayView({
  date,
  events,
  onEventClick,
  loading = false,
  showAllEvents = false,
}: CalendarDayViewProps) {
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

  const getEventsForDay = () => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return isSameDay(eventStart, date) || (
        eventStart <= endOfDay(date) && eventEnd >= startOfDay(date)
      );
    });
  };

  // Eventları saatlerine göre grupla ve sırala
  const getEventsGroupedByHour = () => {
    const dayEvents = getEventsForDay();
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

  const groupedEvents = getEventsGroupedByHour();

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="mb-4">
          <div className="h-6 bg-muted-foreground/20 rounded animate-pulse w-48" />
        </div>
        <div className="bg-border rounded-lg overflow-hidden">
          <div className="h-[600px] bg-muted-foreground/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="mb-4">
        <h3 className={cn(
          "text-lg font-semibold",
          isToday(date) && "text-primary"
        )}>
          {format(date, "EEEE, MMMM d, yyyy")}
          {isToday(date) && <span className="ml-2 text-sm font-normal opacity-70">(Today)</span>}
        </h3>
      </div>

      <div className="bg-border rounded-lg overflow-hidden">
        {/* Time grid */}
        <div className="overflow-y-auto max-h-[600px]">
          {/* Hour rows */}
          {hours.map((hour) => {
            const hourEvents = groupedEvents[hour] || [];
            const cellKey = `${hour}`;
            const isCellExpanded = expandedCells.has(cellKey);
            const shouldShowAll = showAllEvents || isCellExpanded;
            const visibleEvents = shouldShowAll ? hourEvents : hourEvents.slice(0, MAX_VISIBLE_EVENTS);
            const hiddenCount = hourEvents.length - MAX_VISIBLE_EVENTS;

            return (
              <div key={hour} className="grid grid-cols-[100px_1fr] gap-px bg-border">
                {/* Time label */}
                <div
                  className="bg-background text-right text-sm text-muted-foreground pr-3 border-b border-border/50 pt-1"
                  style={{ minHeight: HOUR_HEIGHT }}
                >
                  {format(addHours(startOfDay(date), hour), "HH:mm")}
                </div>

                {/* Day cell for this hour */}
                <div
                  className="bg-background border-b border-border/50 p-2"
                  style={{ minHeight: HOUR_HEIGHT }}
                >
                  {visibleEvents.map((event) => (
                    <div key={event.id} className="mb-1">
                      <EventCard
                        event={event}
                        onClick={() => onEventClick?.(event)}
                      />
                      <MobileEventCard
                        event={event}
                        onClick={() => onEventClick?.(event)}
                      />
                    </div>
                  ))}
                  {!shouldShowAll && hiddenCount > 0 && (
                    <div
                      className="text-sm text-muted-foreground font-medium cursor-pointer hover:text-foreground px-3"
                      onClick={() => toggleCellExpanded(cellKey)}
                    >
                      +{hiddenCount} more
                    </div>
                  )}
                  {isCellExpanded && hourEvents.length > MAX_VISIBLE_EVENTS && (
                    <div
                      className="text-sm text-muted-foreground font-medium cursor-pointer hover:text-foreground px-3"
                      onClick={() => toggleCellExpanded(cellKey)}
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
    </div>
  );
}
