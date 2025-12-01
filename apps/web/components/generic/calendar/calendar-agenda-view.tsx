"use client";

import * as React from "react";
import { format, isToday, isTomorrow, isYesterday, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/shared/utils/index";
import { CalendarEvent } from "./index";
import { EventCard } from "./event-card";

interface CalendarAgendaViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  loading?: boolean;
  showAllEvents?: boolean;
}

export function CalendarAgendaView({
  date,
  events,
  onEventClick,
  loading = false,
  showAllEvents = false,
}: CalendarAgendaViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  const monthEvents = events
    .filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= monthStart && eventStart <= monthEnd;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const groupedEvents = React.useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};

    monthEvents.forEach(event => {
      const eventStart = new Date(event.start);
      const dateKey = format(eventStart, "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [monthEvents]);

  const getDateLabel = (dateStr: string) => {
    const eventDate = new Date(dateStr);

    if (isToday(eventDate)) return "Today";
    if (isTomorrow(eventDate)) return "Tomorrow";
    if (isYesterday(eventDate)) return "Yesterday";

    return format(eventDate, "EEEE, MMMM d");
  };

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 bg-muted-foreground/20 rounded animate-pulse w-32" />
              <div className="space-y-2">
                <div className="h-16 bg-muted-foreground/10 rounded animate-pulse" />
                <div className="h-16 bg-muted-foreground/10 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groupedEvents.length === 0) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">No events scheduled</div>
          <div className="text-sm text-muted-foreground">
            Events for {format(date, "MMMM yyyy")} will appear here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="space-y-6">
        {groupedEvents.map(([dateKey, dayEvents]) => (
          <div key={dateKey} className="space-y-3">
            <h3 className="text-lg font-semibold border-b pb-2">
              {getDateLabel(dateKey)}
            </h3>
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick?.(event)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
