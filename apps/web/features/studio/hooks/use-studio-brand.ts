"use client";

/**
 * Studio Brand Hook
 * 
 * Provides the current brand data from the Studio context.
 * This is a convenience wrapper around useStudioBrandContext.
 */

import { useStudioBrandContext } from "../context/studio-brand-context";

export function useStudioBrand() {
  const { brand, refreshBrand } = useStudioBrandContext();
  return { brand, refreshBrand };
}

/**
 * Hook for calendar publications
 * Fetches publications for a brand and converts them to calendar events
 */
import { useMemo } from "react";
import { listPublications, PublicationListItem } from "@/shared/api/publication";
import { CalendarEvent } from "@/components/generic/calendar";
import { useQuery } from "@tanstack/react-query";

export function useCalendarPublications(brandId: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["publications", brandId],
    queryFn: () => listPublications(brandId, { limit: 100 }),
    enabled: !!brandId,
  });

  const events: CalendarEvent[] = useMemo(() => {
    if (!data?.data?.items) return [];

    return data.data.items.map((publication: PublicationListItem): CalendarEvent => {
      // Use publishedAt if available, otherwise scheduledAt
      const eventDate = publication.publishedAt
        ? new Date(publication.publishedAt)
        : publication.scheduledAt
        ? new Date(publication.scheduledAt)
        : new Date(publication.createdAt);

      // Create end time (assume 1 hour duration for publications)
      const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000);

      // Platform-based colors (fallback for accent lines)
      const getPlatformColor = (platform: string) => {
        switch (platform) {
          case "instagram":
            return "#E4405F";
          case "facebook":
            return "#1877F2";
          default:
            return "#6B46C1";
        }
      };

      // Status-based colors for accent lines (primary)
      const getStatusColor = (status: string) => {
        switch (status) {
          case "scheduled":
            return "#3B82F6"; // Blue
          case "published":
            return "#10B981"; // Green
          case "failed":
            return "#EF4444"; // Red
          case "publishing":
            return "#F59E0B"; // Yellow
          default:
            return getPlatformColor(publication.platform); // Fallback to platform color
        }
      };

      // Generate smart title
      const generateTitle = () => {
        // If there's a title in the publication data, use it
        if (publication.caption && publication.caption.length > 0) {
          // Use first 50 characters as title
          return publication.caption.length > 50
            ? publication.caption.substring(0, 50) + "..."
            : publication.caption;
        }

        // Otherwise generate based on content type
        const platformName = publication.platform.charAt(0).toUpperCase() + publication.platform.slice(1);
        const contentType = publication.contentType.charAt(0).toUpperCase() + publication.contentType.slice(1);

        return `${platformName} ${contentType}`;
      };

      return {
        id: publication.id,
        title: generateTitle(),
        start: eventDate,
        end: endDate,
        description: publication.caption || undefined,
        color: getStatusColor(publication.status),
        socialAccountId: publication.socialAccountId,
        platform: publication.platform,
        status: publication.status,
      };
    });
  }, [data]);

  return {
    events,
    isLoading,
    error,
    refetch,
  };
}

