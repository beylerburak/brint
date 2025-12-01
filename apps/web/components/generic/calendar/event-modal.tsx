"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent } from "./index";

interface EventModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export function EventModal({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EventModalProps) {
  if (!event) return null;

  const duration = React.useMemo(() => {
    const diff = event.end.getTime() - event.start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }, [event.start, event.end]);

  const isMultiDay = React.useMemo(() => {
    return event.start.toDateString() !== event.end.toDateString();
  }, [event.start, event.end]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">
                {event.title}
              </DialogTitle>
              {event.description && (
                <DialogDescription className="text-base">
                  {event.description}
                </DialogDescription>
              )}
            </div>
            {event.color && (
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: event.color }}
              />
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium">
                {isMultiDay ? (
                  <>
                    {format(event.start, "EEEE, MMMM d, yyyy")}
                    <span className="text-muted-foreground mx-2">→</span>
                    {format(event.end, "EEEE, MMMM d, yyyy")}
                  </>
                ) : (
                  format(event.start, "EEEE, MMMM d, yyyy")
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {format(event.start, "HH:mm")} - {format(event.end, "HH:mm")}
                <span className="text-muted-foreground">({duration})</span>
              </div>
            </div>
          </div>

          {/* Duration Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Duration: {duration}
            </Badge>
          </div>

          {/* Event ID for debugging */}
          <div className="text-xs text-muted-foreground border-t pt-2">
            Event ID: {event.id}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {onEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onEdit(event);
                onOpenChange(false);
              }}
            >
              Edit Event
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(event);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
